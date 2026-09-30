import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import ErrorAlert from '../components/ErrorAlert';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../services/apiClient';

const MIN_PASSWORD_LENGTH = 8;

export default function Register() {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await register({ name: form.name, email: form.email, password: form.password });
      navigate('/', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell title="Open a workspace">
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <ErrorAlert message={error} />
        <div>
          <label htmlFor="name" className="field-label">Name</label>
          <input id="name" name="name" required autoComplete="name" className="field" value={form.name} onChange={handleChange} />
        </div>
        <div>
          <label htmlFor="email" className="field-label">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="field" value={form.email} onChange={handleChange} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="password" className="field-label">Password</label>
            <input id="password" name="password" type="password" required autoComplete="new-password" className="field" value={form.password} onChange={handleChange} />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="field-label">Confirm</label>
            <input id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" className="field" value={form.confirmPassword} onChange={handleChange} />
          </div>
        </div>
        <button type="submit" className="btn-ink w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create account →'}
        </button>
      </form>
    </AuthShell>
  );
}
