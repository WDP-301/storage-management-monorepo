import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRoleDefaultPath } from '../../lib/roles';

/**
 * Automatically redirects the authenticated user to their role-specific landing portal.
 */
export const RoleLandingPage: React.FC = () => {
  const { user, activeRole } = useAuth();
  const currentRole = activeRole ?? user?.roles?.[0];
  const target = getRoleDefaultPath(currentRole);

  return <Navigate to={target} replace />;
};
