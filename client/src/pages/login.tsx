import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";

export default function Login() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLocation("/dashboard");
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="flex items-center justify-center min-h-[80vh] px-6">
        <div className="w-full max-w-md bg-s1 border border-b1 p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl text-white">WELCOME BACK</h1>
            <p className="text-muted-foreground mt-2 text-sm">Log in to access your trading terminal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm text-muted-foreground uppercase mb-2">Email</label>
              <input required type="email" placeholder="trader@example.com" className="w-full bg-s2 border border-b1 p-3 text-white focus:border-gold outline-none" data-testid="input-login-email" />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm text-muted-foreground uppercase">Password</label>
                <a href="#" className="text-xs text-gold hover:underline">Forgot?</a>
              </div>
              <input required type="password" placeholder="••••••••" className="w-full bg-s2 border border-b1 p-3 text-white focus:border-gold outline-none" data-testid="input-login-password" />
            </div>

            <button disabled={loading} type="submit" className="w-full bg-gold text-black font-heading text-xl py-3 mt-2 hover:bg-white transition-colors flex justify-center items-center h-14" data-testid="button-login-submit">
              {loading ? <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div> : "LOGIN"}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-8 border-t border-b1 pt-6">
            Don't have an account? <Link href="/apply"><a className="text-white hover:text-gold" data-testid="link-register">Apply Now →</a></Link>
          </p>
        </div>
      </div>
    </div>
  );
}