"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatErrorMessage } from "@/lib/utils";

interface AuthFormProps {
  type: "login" | "register" | "forgot-password";
  onSubmit: (email: string, password: string) => Promise<void>;
  error: string | null;
  loading: boolean;
}

export function AuthForm({ type, onSubmit, error, loading }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (type === "register" && password !== confirmPassword) {
      return; // Handle validation in the parent component
    }
    
    await onSubmit(email, password);
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className="space-y-6"
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      
      {type !== "forgot-password" && (
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>
      )}
      
      {type === "register" && (
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm Password</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>
      )}
      
      {error && (
        <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">
          {error}
        </div>
      )}
      
      <Button
        type="submit"
        className="w-full"
        disabled={loading}
      >
        {loading ? "Loading..." : getButtonText(type)}
      </Button>
    </form>
  );
}

function getButtonText(type: "login" | "register" | "forgot-password"): string {
  switch (type) {
    case "login":
      return "Sign In";
    case "register":
      return "Create Account";
    case "forgot-password":
      return "Reset Password";
  }
} 