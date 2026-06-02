import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  activateUser,
  deactivateUser,
  getUserActivity,
  getUserById,
  listUsersV2,
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
