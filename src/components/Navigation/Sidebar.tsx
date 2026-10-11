import { useTranslation } from "react-i18next";
import { 
  LayoutDashboard, 
  Server, 
  Network, 
  Clock, 
  Star, 
  Settings,
  KeyRound
} from "lucide-react";
import { motion } from "framer-motion";
import NavItem from "./NavItem";
import { useStore } from "../../store";

const sidebarVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      staggerChildren: 0.05,
      delayChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 }
};

export default function Sidebar() {
  const { t } = useTranslation();
  const { 
    activeTab, 
    setActiveTab,
    tunnels
  } = useStore();

  const activeTunnelsCount = tunnels.filter(t => t.status === 'active').length;

  return (
    <motion.aside 
      className="flex flex-col h-full bg-[#0a100e] rounded-3xl border border-emerald-500/10 overflow-hidden"
      variants={sidebarVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Main Navigation */}
      <motion.div className="p-4 space-y-1" variants={itemVariants}>
        <NavItem 
          icon={<LayoutDashboard size={18} />} 
          label={t('nav.dashboard')} 
          active={activeTab === 'dashboard'}
          onClick={() => setActiveTab('dashboard')}
        />
        <NavItem 
          icon={<Network size={18} />} 
          label={t('nav.activeConnections')} 
          active={activeTab === 'active-connections'}
          onClick={() => setActiveTab('active-connections')}
          badge={activeTunnelsCount > 0 ? activeTunnelsCount : undefined}
        />
        <NavItem 
          icon={<Server size={18} />} 
          label={t('nav.servers')} 
          active={activeTab === 'servers'}
          onClick={() => setActiveTab('servers')}
        />
        <NavItem 
          icon={<KeyRound size={18} />} 
          label={t('nav.keepass')} 
          active={activeTab === 'keepass'}
          onClick={() => setActiveTab('keepass')}
        />
      </motion.div>

      <div className="h-px bg-emerald-500/10 mx-4 my-2" />

      {/* Quick Access */}
      <motion.div className="p-4 space-y-1" variants={itemVariants}>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-2">
          {t('common.info')}
        </div>
        <NavItem 
          icon={<Clock size={18} />} 
          label={t('nav.recent')} 
          active={activeTab === 'recent'}
          onClick={() => setActiveTab('recent')}
        />
        <NavItem 
          icon={<Star size={18} />} 
          label={t('nav.favorites')} 
          active={activeTab === 'favorites'}
          onClick={() => setActiveTab('favorites')}
        />
      </motion.div>

      <div className="h-px bg-emerald-500/10 mx-4 my-2" />

      {/* Settings at bottom */}
      <motion.div className="p-4 mt-auto border-t border-emerald-500/10" variants={itemVariants}>
        <NavItem 
          icon={<Settings size={18} />} 
          label={t('nav.settings')} 
          active={activeTab === 'settings'}
          onClick={() => setActiveTab('settings')}
        />
      </motion.div>
    </motion.aside>
  );
}