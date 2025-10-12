const MemberPayments = () => {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Coming Soon Card */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 sm:p-12 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-20 h-20 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-purple-600"
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
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Payment History
          </h2>
          <p className="text-gray-400 text-sm sm:text-base mb-6">
            View your membership payment history and download receipts. This
            feature will be available soon!
          </p>
          <div className="bg-purple-600/10 border border-purple-600/30 rounded-lg p-4">
            <p className="text-purple-600 font-medium text-sm">
              🚀 Coming Soon
            </p>
          </div>
        </div>
      </div>

      {/* Feature Preview */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-bold text-white mb-4">
          What You'll Be Able To Do:
        </h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-green-600/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg
                className="w-4 h-4 text-green-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium text-sm sm:text-base">
                View Payment History
              </p>
              <p className="text-gray-400 text-xs sm:text-sm">
                See all your past membership payments
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-green-600/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg
                className="w-4 h-4 text-green-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium text-sm sm:text-base">
                Download Receipts
              </p>
              <p className="text-gray-400 text-xs sm:text-sm">
                Get digital copies of your payment receipts
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-green-600/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg
                className="w-4 h-4 text-green-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium text-sm sm:text-base">
                Track Payment Status
              </p>
              <p className="text-gray-400 text-xs sm:text-sm">
                Monitor pending and completed payments
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-green-600/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg
                className="w-4 h-4 text-green-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium text-sm sm:text-base">
                View Next Due Date
              </p>
              <p className="text-gray-400 text-xs sm:text-sm">
                Stay updated on your upcoming payment deadlines
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberPayments;
