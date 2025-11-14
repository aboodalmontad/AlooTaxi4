import React, { useState, useEffect, useMemo } from 'react';
import { getAllUsers, verifyUser, deleteUser, setUserActivationCode } from '../../services/supabase';
import type { User, UserRole } from '../../types';
import { Search, Trash2, UserCheck, ShieldAlert, MessageSquare } from 'lucide-react';
import Modal from '../ui/Modal';
import NotificationPopup from '../ui/NotificationPopup';


const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
    const [verifiedFilter, setVerifiedFilter] = useState<'all' | 'verified' | 'unverified'>('all');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);

    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const userList = await getAllUsers();
            setUsers(userList);
        } catch (err) {
            setError('فشل في تحميل بيانات المستخدمين.');
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        fetchUsers();
    }, []);

    const handleVerify = async (userId: string) => {
        const success = await verifyUser(userId);
        if (success) {
            setNotification({ message: 'تم تفعيل المستخدم بنجاح!', type: 'success' });
            fetchUsers(); // Refresh the list
        } else {
            setNotification({ message: 'فشل في تفعيل المستخدم.', type: 'error' });
        }
    };

    const openDeleteModal = (user: User) => {
        setUserToDelete(user);
        setIsModalOpen(true);
    };

    const handleDelete = async () => {
        if (!userToDelete) return;
        const success = await deleteUser(userToDelete.id);
        if (success) {
            setNotification({ message: 'تم حذف المستخدم بنجاح!', type: 'success' });
            fetchUsers(); // Refresh the list
        } else {
             setNotification({ message: 'فشل في حذف المستخدم.', type: 'error' });
        }
        setIsModalOpen(false);
        setUserToDelete(null);
    };

    const handleSendActivationCode = async (user: User) => {
        const activationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Save the code to the database
        const result = await setUserActivationCode(user.id, activationCode);

        if (result.success) {
            const message = `مرحباً ${user.name}،\nكود تفعيل حسابك في تطبيق ألو تكسي هو: ${activationCode}`;
            // Prepend Syrian country code if missing for better compatibility
            const fullPhoneNumber = user.phone.startsWith('963') ? user.phone : `963${user.phone.substring(1)}`;
            const whatsappUrl = `https://wa.me/${fullPhoneNumber}?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
            setNotification({ message: `تم تجهيز رسالة واتساب بالكود للمستخدم ${user.name}`, type: 'info' });
        } else {
            let errorMessage = `فشل في حفظ كود التفعيل للمستخدم ${user.name}.`;
            // Check for the specific schema cache error
            if (result.message && (result.message.includes("does not exist") || result.message.includes("Could not find the 'activation_code' column"))) {
                 errorMessage = 'خطأ: حقل "activation_code" غير موجود. يرجى تشغيل سكربت الإعداد وتحديث مخطط API كما هو موضح في دليل الإعداد.';
            } else if (result.message) {
                 errorMessage += ` السبب: ${result.message}`;
            }
            setNotification({ message: errorMessage, type: 'error' });
        }
    };

    const filteredUsers = useMemo(() => {
        return users
            .filter(user => searchTerm ? user.name.includes(searchTerm) || user.phone.includes(searchTerm) : true)
            .filter(user => roleFilter === 'all' ? true : user.role === roleFilter)
            .filter(user => {
                if (verifiedFilter === 'all') return true;
                return verifiedFilter === 'verified' ? user.is_verified : !user.is_verified;
            });
    }, [users, searchTerm, roleFilter, verifiedFilter]);

    const getRoleText = (role: UserRole) => {
        const roles = { customer: 'زبون', driver: 'سائق', province_admin: 'مدير محافظة', super_admin: 'مدير عام' };
        return roles[role] || role;
    }

    return (
        <div className="animate-fade-in text-white">
             {notification && <NotificationPopup message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
            <h1 className="text-3xl font-bold mb-6">إدارة المستخدمين</h1>

            <div className="bg-slate-800 p-4 rounded-xl mb-6 border border-slate-700 flex flex-col md:flex-row gap-4">
                <div className="relative flex-grow">
                    <Search className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400 h-5 w-5" />
                    <input type="text" placeholder="ابحث بالاسم أو رقم الهاتف..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg pr-10 pl-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </div>
                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as any)} className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500">
                    <option value="all">كل الأدوار</option>
                    <option value="customer">زبون</option>
                    <option value="driver">سائق</option>
                </select>
                <select value={verifiedFilter} onChange={e => setVerifiedFilter(e.target.value as any)} className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500">
                    <option value="all">كل الحالات</option>
                    <option value="verified">مُفعّل</option>
                    <option value="unverified">غير مُفعّل</option>
                </select>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead className="bg-slate-700/50">
                            <tr>
                                <th className="p-4 font-semibold">الاسم</th>
                                <th className="p-4 font-semibold">رقم الهاتف</th>
                                <th className="p-4 font-semibold">الدور</th>
                                <th className="p-4 font-semibold">الحالة</th>
                                <th className="p-4 font-semibold">تاريخ التسجيل</th>
                                <th className="p-4 font-semibold">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} className="text-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400 mx-auto"></div></td></tr>
                            ) : error ? (
                                <tr><td colSpan={6} className="text-center p-8 text-red-400">{error}</td></tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr><td colSpan={6} className="text-center p-8 text-slate-500">لا يوجد مستخدمون يطابقون معايير البحث.</td></tr>
                            ) : (
                                filteredUsers.map(user => (
                                    <tr key={user.id} className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors">
                                        <td className="p-4">{user.name}</td>
                                        <td className="p-4" dir="ltr">{user.phone}</td>
                                        <td className="p-4">{getRoleText(user.role)}</td>
                                        <td className="p-4">
                                            <span className={`px-3 py-1 text-xs font-bold rounded-full ${user.is_verified ? 'bg-green-500/20 text-green-300' : 'bg-amber-500/20 text-amber-300'}`}>
                                                {user.is_verified ? 'مُفعّل' : 'قيد المراجعة'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-slate-400">{new Date(user.created_at).toLocaleDateString('ar-SY')}</td>
                                        <td className="p-4 flex items-center gap-2">
                                            {!user.is_verified && user.role !== 'super_admin' && (
                                                <>
                                                    <button onClick={() => handleVerify(user.id)} className="p-2 text-green-400 hover:bg-green-500/20 rounded-full transition" title="تفعيل الحساب">
                                                        <UserCheck size={20} />
                                                    </button>
                                                    <button onClick={() => handleSendActivationCode(user)} className="p-2 text-sky-400 hover:bg-sky-500/20 rounded-full transition" title="إرسال كود التفعيل عبر واتساب">
                                                        <MessageSquare size={20} />
                                                    </button>
                                                </>
                                            )}
                                            {user.role !== 'super_admin' && (
                                                <button onClick={() => openDeleteModal(user)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-full transition" title="حذف الحساب">
                                                    <Trash2 size={20} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

             <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="تأكيد الحذف">
                {userToDelete && (
                    <div>
                        <p className="mb-6 text-slate-300">هل أنت متأكد من رغبتك في حذف المستخدم <span className="font-bold text-amber-400">{userToDelete.name}</span>؟ لا يمكن التراجع عن هذا الإجراء.</p>
                        <div className="flex justify-end gap-4">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg transition">إلغاء</button>
                            <button onClick={handleDelete} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition flex items-center gap-2">
                                <ShieldAlert size={18} /> نعم، قم بالحذف
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default UserManagement;