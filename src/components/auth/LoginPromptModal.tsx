import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { X, LogIn, UserPlus } from 'lucide-react';

interface LoginPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginPromptModal: React.FC<LoginPromptModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();

  if (!isOpen) return null;

  const handleSignIn = () => {
    onClose();
    navigate('/login', { state: { from: location } });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 space-y-6 z-10">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-14 h-14 bg-neutral-100 rounded-full flex items-center justify-center">
            <LogIn className="w-6 h-6 text-neutral-800" />
          </div>
        </div>

        {/* Text */}
        <div className="text-center space-y-2">
          <h3 className="font-display font-black text-xl text-neutral-900 uppercase tracking-tight">
            Sign In to Apply
          </h3>
          <p className="text-xs text-neutral-500 leading-relaxed">
            You need a free Grail account to apply for positions, track your applications, and save opportunities to your dashboard.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleSignIn}
            className="w-full py-3 bg-[#121212] text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 transition-colors uppercase tracking-wider font-mono flex items-center justify-center gap-2"
          >
            <LogIn className="w-3.5 h-3.5" />
            Sign In
          </button>

          <Link
            to="/register"
            onClick={onClose}
            className="w-full py-2.5 border border-neutral-200 text-neutral-900 rounded-lg text-xs font-semibold hover:bg-neutral-50 transition-colors flex items-center justify-center gap-2"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Create Free Account
          </Link>
        </div>

        <p className="text-center text-[11px] text-neutral-400">
          Already have an account?{' '}
          <button
            onClick={handleSignIn}
            className="font-semibold text-neutral-900 underline"
          >
            Sign in here
          </button>
        </p>
      </div>
    </div>
  );
};

