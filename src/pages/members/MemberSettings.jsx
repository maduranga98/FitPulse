import { useState } from "react";
import MemberLayout from "../../components/MemberLayout";
import MemberComplaints from "./settings/MemberComplaints";
import MemberPayments from "./settings/MemberPayments";
import MemberProfile from "./settings/MemberProfile";

const MemberSettings = () => {
  const [activeTab, setActiveTab] = useState("profile");

  return (
    <MemberLayout>
      <div className="min-h-full bg-gray-900 pb-20">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 sm:p-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
              Settings
            </h1>
            <p className="text-sm sm:text-base text-white/80">
              Manage your account and preferences
            </p>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-4 sm:mt-6">
          <div className="bg-gray-800 rounded-xl p-1 border border-gray-700 overflow-x-auto">
            <div className="flex gap-1 min-w-max">
              <button
                onClick={() => setActiveTab("profile")}
                className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium transition text-sm sm:text-base whitespace-nowrap active:scale-95 ${
                  activeTab === "profile"
                    ? "bg-purple-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  Profile
                </div>
              </button>

              <button
                onClick={() => setActiveTab("complaints")}
                className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium transition text-sm sm:text-base whitespace-nowrap active:scale-95 ${
                  activeTab === "complaints"
                    ? "bg-purple-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                    />
                  </svg>
                  Complaints
                </div>
              </button>

              <button
                onClick={() => setActiveTab("payments")}
                className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium transition text-sm sm:text-base whitespace-nowrap active:scale-95 ${
                  activeTab === "payments"
                    ? "bg-purple-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  Payments
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          {activeTab === "profile" && <MemberProfile />}
          {activeTab === "complaints" && <MemberComplaints />}
          {activeTab === "payments" && <MemberPayments />}
        </div>

        {/* Footer */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-8 sm:mt-12 pb-8">
          <div className="border-t border-gray-700 pt-6">
            <div className="text-center">
              <p className="text-gray-400 text-xs sm:text-sm">Powered by</p>
              <p className="text-white font-semibold text-sm sm:text-base mt-1">
                Lumora Ventures PVT LTD
              </p>
            </div>
          </div>
        </div>
      </div>
    </MemberLayout>
  );
};

export default MemberSettings;
