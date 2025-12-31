import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { Card, CardContent, CardHeader } from '../components/Card';
import { LogOut, Moon, Sun, Monitor, Bell, Shield } from 'lucide-react';

export function SettingsPage() {
    const { user, logout } = useAuth();

    return (
        <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-2xl font-bold text-slate-900 mb-6">Settings</h1>

                {/* Account */}
                <Card className="mb-6">
                    <CardHeader>
                        <h2 className="font-semibold text-slate-900">Account</h2>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
                                {user?.firstName?.[0]}{user?.lastName?.[0]}
                            </div>
                            <div>
                                <div className="font-semibold text-lg">{user?.firstName} {user?.lastName}</div>
                                <div className="text-slate-500">{user?.email}</div>
                                <div className="text-sm text-primary-600 font-medium mt-1">{user?.role}</div>
                            </div>
                        </div>
                        <Button variant="danger" onClick={logout} className="w-full">
                            <LogOut className="w-5 h-5" />
                            Sign Out
                        </Button>
                    </CardContent>
                </Card>

                {/* Display */}
                <Card className="mb-6">
                    <CardHeader>
                        <h2 className="font-semibold text-slate-900">Display</h2>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Sun className="w-5 h-5 text-slate-500" />
                                    <span className="font-medium">Theme</span>
                                </div>
                                <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                                    <button className="px-4 py-2 rounded-md bg-white shadow-sm text-sm font-medium">Light</button>
                                    <button className="px-4 py-2 rounded-md text-sm font-medium text-slate-500">Dark</button>
                                    <button className="px-4 py-2 rounded-md text-sm font-medium text-slate-500">System</button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Notifications */}
                <Card className="mb-6">
                    <CardHeader>
                        <h2 className="font-semibold text-slate-900">Notifications</h2>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Bell className="w-5 h-5 text-slate-500" />
                                <span className="font-medium">Push Notifications</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" defaultChecked />
                                <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-primary-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                            </label>
                        </div>
                    </CardContent>
                </Card>

                {/* Security */}
                <Card>
                    <CardHeader>
                        <h2 className="font-semibold text-slate-900">Security</h2>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Shield className="w-5 h-5 text-slate-500" />
                                <div>
                                    <div className="font-medium">Auto-Logout</div>
                                    <div className="text-sm text-slate-500">Logout after 15 minutes of inactivity</div>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" defaultChecked />
                                <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-primary-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                            </label>
                        </div>
                    </CardContent>
                </Card>

                <p className="text-center text-sm text-slate-400 mt-8">
                    PageMD Tablet UI v1.0.0 • HIPAA Compliant
                </p>
            </div>
        </div>
    );
}
