import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store';

interface RoleProtectedRouteProps {
  allowedRoles: string[];
}

const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({ allowedRoles }) => {
  const { user, isAuthenticated } = useAuthStore();

  // Not authenticated → redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated but role not allowed → redirect to dashboard
  if (user && !allowedRoles.includes(user.role)) {
    console.warn(`Access denied: User role "${user.role}" not in allowed roles [${allowedRoles.join(', ')}]`);
    return <Navigate to="/dashboard" replace />;
  }

  // Role allowed → render child routes
  return <Outlet />;
};

export default RoleProtectedRoute;
