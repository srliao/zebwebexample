package main

import (
	"io"
	"log"
	"net"
	"net/http"
	"os"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func main() {
	telnetAddr := os.Getenv("TELNET_ADDR")
	if telnetAddr == "" {
		log.Fatal("TELNET_ADDR env variable required (e.g. localhost:23)")
	}

	listenAddr := os.Getenv("LISTEN_ADDR")
	if listenAddr == "" {
		listenAddr = ":8080"
	}

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		ws, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("websocket upgrade: %v", err)
			return
		}
		defer ws.Close()

		tcp, err := net.Dial("tcp", telnetAddr)
		if err != nil {
			log.Printf("dial telnet %s: %v", telnetAddr, err)
			ws.WriteMessage(websocket.CloseMessage,
				websocket.FormatCloseMessage(websocket.CloseInternalServerErr, "telnet unavailable"))
			return
		}
		defer tcp.Close()

		log.Printf("proxying %s <-> %s", r.RemoteAddr, telnetAddr)

		done := make(chan struct{})

		// telnet -> websocket
		go func() {
			defer close(done)
			buf := make([]byte, 4096)
			for {
				n, err := tcp.Read(buf)
				if n > 0 {
					if werr := ws.WriteMessage(websocket.BinaryMessage, buf[:n]); werr != nil {
						return
					}
				}
				if err != nil {
					if err != io.EOF {
						log.Printf("telnet read: %v", err)
					}
					return
				}
			}
		}()

		// websocket -> telnet
		for {
			_, msg, err := ws.ReadMessage()
			if err != nil {
				break
			}
			if _, err := tcp.Write(msg); err != nil {
				log.Printf("telnet write: %v", err)
				break
			}
		}

		tcp.Close()
		<-done
		log.Printf("closed %s", r.RemoteAddr)
	})

	log.Printf("listening on %s, proxying to %s", listenAddr, telnetAddr)
	if err := http.ListenAndServe(listenAddr, nil); err != nil {
		log.Fatal(err)
	}
}
