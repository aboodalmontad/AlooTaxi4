import React, { useState, useRef, useEffect } from 'react';
import { Key, Send, LogOut } from 'lucide-react';
import { verifyActivationCode } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { User } from '../../types';

interface ActivationScreenProps {
    user: User;
    onActivationSuccess: (user: User) => void;
}

const ActivationScreen: React.FC<ActivationScreenProps> = ({ user, onActivationSuccess }) => {
    const [code, setCode] = useState<string[]>(new Array(6).fill(''));
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { logout } = useAuth();
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        inputRefs.current[0]?.focus();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const { value } = e.target;
        if (/[^0-9]/.test(value)) return; // Only allow numbers

        const newCode = [...code];
        newCode[index] = value;
        setCode(newCode);

        // Move to next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };
    
    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasteData = e.clipboardData.getData('text').slice(0, 6);
        if (/[^0-9]/.test(pasteData)) return;
        const newCode = [...code];
        for (let i = 0; i < pasteData.length; i++) {
            newCode[i] = pasteData[i];
        }
        setCode(newCode);
        const focusIndex = Math.min(pasteData.length, 5);
        inputRefs.current[focusIndex]?.focus();
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const fullCode = code.join('');
        if (fullCode.length !== 6) {
            setError('الرجاء إدخال الكود المكون من 6 أرقام كاملاً.');
            return;
        }
        setError('');
        setLoading(true);

        const updatedUser = await verifyActivationCode(user.id, fullCode);
        
        if (updatedUser) {
            onActivationSuccess(updatedUser);
        } else {
            setError('الكود غير صحيح أو منتهي الصلاحية. يرجى المحاولة مرة أخرى.');
            setCode(new Array(6).fill(''));
            inputRefs.current[0]?.focus();
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 text-white text-center">
                <Key className="h-16 w-16 mx-auto text-sky-400 mb-4" />
                <h1 className="text-3xl font-bold mb-2">تفعيل الحساب</h1>
                <p className="text-slate-300 mb-6">
                    تم إرسال كود تفعيل مكون من 6 أرقام إلى رقمك عبر واتساب. يرجى إدخاله أدناه.
                </p>

                {error && <p className="bg-red-500/50 text-white p-3 rounded-lg mb-4 text-center">{error}</p>}

                <form onSubmit={handleSubmit}>
                    <div className="flex justify-center gap-2 mb-6" dir="ltr">
                        {code.map((digit, index) => (
                            <input
                                key={index}
                                ref={el => inputRefs.current[index] = el}
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleChange(e, index)}
                                onKeyDown={(e) => handleKeyDown(e, index)}
                                onPaste={handlePaste}
                                required
                                className="w-12 h-14 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-center text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
                            />
                        ))}
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105 disabled:bg-slate-500 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    >
                        {loading ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div> : <><Send size={18} /> تفعيل الحساب</>}
                    </button>
                </form>
                
                 <div className="text-center mt-6 pt-4 border-t border-slate-700/50">
                    <button
                        onClick={logout}
                        className="text-sm text-slate-400 hover:text-red-400 transition flex items-center justify-center gap-2 w-full"
                    >
                        <LogOut size={16} />
                        <span>العودة وتسجيل الدخول برقم آخر</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ActivationScreen;
