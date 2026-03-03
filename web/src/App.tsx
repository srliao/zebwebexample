import { MudProvider, useMudContext } from './context/MudContext'
import Terminal from './Terminal'
import InputBar from './components/InputBar'
import Toolbar from './components/Toolbar'

function AppLayout() {
  const { addons, sendCommand } = useMudContext()

  const sidebarAddons = addons.filter((a) => a.panelPosition === 'sidebar-right')
  const bottomAddons = addons.filter((a) => a.panelPosition === 'bottom')

  const hasSidebar = sidebarAddons.length > 0
  const hasBottom = bottomAddons.length > 0

  const appClass = [
    'app',
    hasSidebar ? 'app--has-sidebar' : '',
    hasBottom ? 'app--has-bottom' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={appClass}>
      <Toolbar />
      <div className="app__main">
        <Terminal />
        {hasSidebar && (
          <aside className="app__sidebar">
            {sidebarAddons.map((addon) => (
              <addon.component key={addon.id} sendCommand={sendCommand} />
            ))}
          </aside>
        )}
      </div>
      {hasBottom && (
        <div className="app__bottom">
          {bottomAddons.map((addon) => (
            <addon.component key={addon.id} sendCommand={sendCommand} />
          ))}
        </div>
      )}
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
