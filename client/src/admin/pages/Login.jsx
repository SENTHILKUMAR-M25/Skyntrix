import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useToast } from "../Toast";
import { Button, Field, Input, Spinner } from "../components/Ui";

export default function Login() {
  const { admin, login, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-base">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (admin) return <Navigate to="/admin/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      toast.ok("Welcome back!");
      navigate("/admin/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-base bg-grid px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-primary-gradient font-display text-2xl font-extrabold text-white shadow-soft">
            S
          </div>
          <h1 className="heading-md text-ink">Skyntrix Admin</h1>
          <p className="mt-1 text-sm text-ink/50">Sign in to manage your website</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          <Field label="Email" required>
            <Input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@skyntrix.com" autoComplete="email" />
          </Field>
          <Field label="Password" required>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
          </Field>

          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

          <Button type="submit" className="w-full" loading={busy}>{busy ? "Signing in..." : "Sign in"}</Button>
        </form>

        <p className="mt-4 text-center text-xs text-ink/40">Protected area · Skyntrix Technologies</p>
      </div>
    </div>
  );
}