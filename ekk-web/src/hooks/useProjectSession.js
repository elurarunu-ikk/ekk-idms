import { useEffect, useState } from 'react';
import {
  getAccessibleProjects,
  getSelectedProject,
  getSelectedProjectId,
  getUserProfile,
  hasPermission,
  setSelectedProjectId,
} from '../services/session';

const useProjectSession = () => {
  const [projects, setProjects] = useState(getAccessibleProjects());
  const [selectedProjectId, setSelectedProjectState] = useState(getSelectedProjectId());
  const [user, setUser] = useState(getUserProfile());

  useEffect(() => {
    const sync = () => {
      setProjects(getAccessibleProjects());
      setSelectedProjectState(getSelectedProjectId());
      setUser(getUserProfile());
    };

    window.addEventListener('project-changed', sync);
    window.addEventListener('session-changed', sync);
    return () => {
      window.removeEventListener('project-changed', sync);
      window.removeEventListener('session-changed', sync);
    };
  }, []);

  return {
    user,
    projects,
    selectedProjectId,
    selectedProject: getSelectedProject(),
    setSelectedProjectId: (projectId) => setSelectedProjectId(projectId),
    hasPermission,
  };
};

export default useProjectSession;