import { UserRole } from '@storage/types';
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRoleDefaultPath } from '../../lib/roles';

/**
 * Automatically redirects the authenticated user to their role-specific landing portal.
 */
export const RoleLandingPage: React.FC = () => {
  const { user } = useAuth();
  const primaryRole = user?.roles?.[0] || UserRole.CUSTOMER;
  const target = getRoleDefaultPath(primaryRole);

  return <Navigate to={target} replace />;
};
