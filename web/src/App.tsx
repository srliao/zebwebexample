import { MudProvider, useMudContext } from './context/MudContext'
import Terminal from './Terminal'
import InputBar from './components/InputBar'
import Toolbar from './components/Toolbar'
import MapperAddon from './components/addons/MapperAddon'
import ShoutAddon from './components/addons/ShoutAddon'

function AppLayout() {
  const { sendCommand } = useMudContext()

  return (
    <div className="app">
      <Toolbar />
      <div className="app__main">
        <Terminal />
        <aside className="app__sidebar">
          <div className="app__sidebar-top">
            <MapperAddon sendCommand={sendCommand} />
          </div>
          <div className="app__sidebar-bottom">
            <ShoutAddon sendCommand={sendCommand} />
          </div>
        </aside>
      </div>
      <InputBar />
    </div>
  )
}

export default function App() {
  return (
    <MudProvider>
      <AppLayout />
    </MudProvider>
  )
}
