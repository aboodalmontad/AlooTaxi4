
import { createContext } from 'react';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  login: (userData: User) => void; // Kept for ActivationScreen compatibility
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
});
