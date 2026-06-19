import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  activateUser,
  deactivateUser,
  forceLogoutUser,
  getUserActivity,
  getUserById,
  getUserDeviceSessions,
  getUserSites,
  listUsersV2,
  resetUserDevice,
  updateUserSites,
} from '../services/apiService';

export const useUserList = (filters) =>
  useQuery({
    queryKey: ['users', filters],
    queryFn: () => listUsersV2(filters),
    keepPreviousData: true,
  });

export const useUser = (id) =>
  useQuery({
    queryKey: ['user', id],
    queryFn: () => getUserById(id),
    enabled: !!id,
  });

export const useUserActivity = () =>
  useQuery({
    queryKey: ['user-activity'],
    queryFn: getUserActivity,
    retry: false,
  });

export const useDeactivateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deactivated');
    },
    onError: (err) => toast.error(err?.response?.data?.detail || 'Failed to deactivate'),
  });
};

export const useActivateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: activateUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('User activated');
    },
    onError: (err) => toast.error(err?.response?.data?.detail || 'Failed to activate'),
  });
};

export const useUserSites = (id) =>
  useQuery({
    queryKey: ['user-sites', id],
    queryFn: () => getUserSites(id),
    enabled: !!id,
    refetchOnWindowFocus: false,
  });

export const useUpdateUserSites = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => updateUserSites(id, payload),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['user-sites', id] });
      toast.success('Site assignments updated');
    },
    onError: (err) => toast.error(err?.response?.data?.detail || 'Failed to update sites'),
  });
};

export const useUserDeviceSessions = (id) =>
  useQuery({
    queryKey: ['user-device-sessions', id],
    queryFn: () => getUserDeviceSessions(id),
    enabled: !!id,
    refetchOnWindowFocus: false,
  });

export const useResetDevice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => resetUserDevice(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['user-device-sessions', id] });
      toast.success('Device registration cleared');
    },
    onError: (err) => toast.error(err?.response?.data?.detail || 'Failed to reset device'),
  });
};

export const useForceLogout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, platform }) => forceLogoutUser(id, platform),
    onSuccess: (data, { id }) => {
      qc.invalidateQueries({ queryKey: ['user-device-sessions', id] });
      toast.success(data?.message || 'Session terminated');
    },
    onError: (err) => toast.error(err?.response?.data?.detail || 'Failed to force logout'),
  });
};
