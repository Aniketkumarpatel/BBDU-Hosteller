import { useAuth } from '../../context/AuthContext.jsx';
import StudentMess from './StudentMess.jsx';
import ManagerMess from './ManagerMess.jsx';

/**
 * One address, two screens (DEC-037): a student sees the menu and rates it; everyone who runs a
 * mess (Warden, technician, Authority, Admin) sees the management screen for the mess they may manage.
 */
export default function MessPage() {
  const { user } = useAuth();
  return user?.role === 'STUDENT' ? <StudentMess /> : <ManagerMess />;
}
