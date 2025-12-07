import React from "react";

export default function AccountSettings() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold mb-4 text-app-text">Account</h2>
                <p className="text-app-text-secondary mb-6">
                    Manage your account settings and preferences.
                </p>
            </div>

            <div className="bg-app-panel border border-app-border rounded-lg p-6">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-app-accent rounded-full flex items-center justify-center text-2xl text-white font-bold">
                        P
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-app-text">Pratham</h3>
                        <p className="text-app-text-secondary">pratham@example.com</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-app-border">
                        <div>
                            <h4 className="font-medium text-app-text">Plan</h4>
                            <p className="text-xs text-app-text-secondary">Current subscription plan</p>
                        </div>
                        <span className="px-3 py-1 bg-app-accent/10 text-app-accent rounded-full text-xs font-medium">Pro</span>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-app-border">
                        <div>
                            <h4 className="font-medium text-app-text">Member since</h4>
                            <p className="text-xs text-app-text-secondary">Account creation date</p>
                        </div>
                        <span className="text-sm text-app-text">Nov 2023</span>
                    </div>

                    <div className="pt-4">
                        <button className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-md text-sm font-medium transition-colors">
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
