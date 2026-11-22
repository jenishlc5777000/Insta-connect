import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Button, Field, Input, Modal } from './ui';
import { post, errorMessage, applyFieldErrors } from '../services/api';
import { useAuth } from '../context/AuthContext';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'At least 8 characters').regex(/[A-Za-z]/, 'Include a letter').regex(/[0-9]/, 'Include a number'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export default function ChangePasswordModal({ open, onClose, forced }) {
  const { setSession } = useAuth();
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ currentPassword, newPassword }) => {
    try {
      const res = await post('/auth/change-password', { currentPassword, newPassword });
      setSession({ user: res.data.user, influencer: res.data.influencer || null });
      toast.success('Password updated');
      reset();
      onClose();
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err));
    }
  };

  return (
    <Modal open={open} onClose={forced ? () => {} : onClose} title={forced ? 'Set a new password' : 'Change password'} size="sm">
      {forced && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">For your security, please replace the temporary password you were given.</p>}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label={forced ? 'Temporary password' : 'Current password'} error={errors.currentPassword?.message}>
          <Input type="password" autoComplete="current-password" {...register('currentPassword')} error={errors.currentPassword} />
        </Field>
        <Field label="New password" error={errors.newPassword?.message} hint="8+ characters with letters and numbers">
          <Input type="password" autoComplete="new-password" {...register('newPassword')} error={errors.newPassword} />
        </Field>
        <Field label="Confirm new password" error={errors.confirm?.message}>
          <Input type="password" autoComplete="new-password" {...register('confirm')} error={errors.confirm} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          {!forced && (
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button type="submit" loading={isSubmitting}>
            Update password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
