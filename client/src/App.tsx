import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import Apply from "@/pages/apply";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Leaderboard from "@/pages/leaderboard";
import Admin from "@/pages/admin";
import Pending from "@/pages/pending";
import Pricing from "@/pages/pricing";
import Onboarding from "@/pages/onboarding";
import AIPage from "@/pages/ai";
import NotFound from "@/pages/not-found";
import SupportChat from "@/components/SupportChat";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home}/>
      <Route path="/apply" component={Apply}/>
      <Route path="/login" component={Login}/>
      <Route path="/dashboard" component={Dashboard}/>
      <Route path="/leaderboard" component={Leaderboard}/>
      <Route path="/admin" component={Admin}/>
      <Route path="/pending" component={Pending}/>
      <Route path="/pricing" component={Pricing}/>
      <Route path="/onboarding" component={Onboarding}/>
      <Route path="/ai" component={AIPage}/>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
        <SupportChat />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;