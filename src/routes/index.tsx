import { createFileRoute } from "@tanstack/react-router";
import Sidebar from "../components/Navigation/Sidebar";
import Header from "../components/Header/Header";
import Dashboard from "../components/Dashboard/Dashboard";
import ActiveConnections from "../components/Tunnels/ActiveConnections";
import Settings from "../components/Settings/Settings";
import ServerManagement from "../components/Servers/ServerManagement";
import RecentConnections from "../components/Recent/RecentConnections";
import Favorites from "../components/Favorites/Favorites";
import KeePassPanel from "../components/KeePass/KeePassPanel";
import { useKeePassAutoLock } from "../components/KeePass/useKeePassAutoLock";
import { useStore } from "../store";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { activeTab } = useStore();
  useKeePassAutoLock();

  // Render different views based on active tab
  const renderView = () => {
    switch (activeTab) {
      case 'active-connections':
        return <ActiveConnections />;
      case 'servers':
        return <ServerManagement />;
      case 'recent':
        return <RecentConnections />;
      case 'favorites':
        return <Favorites />;
      case 'keepass':
        return <KeePassPanel />;
      case 'settings':
        return <Settings />;
      case 'dashboard':
      default:
        return <Dashboard />;
    }
  };

  return (
    <>
      <Header />
      <div className="flex flex-col h-full px-6 pb-6">
        <div className="flex h-[calc(100vh-100px)] gap-6">
          <div className="w-64 shrink-0">
            <Sidebar />
          </div>
          <div className="flex-1 bg-[#0a0a0a] rounded-3xl border border-white/5 overflow-hidden relative">
            {/* Background gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
              <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/5 blur-[100px]" />
              <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/5 blur-[100px]" />
            </div>
            
            <div className="relative z-10 h-full">
              {renderView()}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
