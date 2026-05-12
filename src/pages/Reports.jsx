import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNotification } from "../contexts/NotificationContext";
import Sidebar from "../components/Sidebar";
import { isAdmin, validateGymId } from "../utils/authUtils";

const Reports = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const currentGymId = user?.gymId;
  const userIsAdmin = isAdmin(user);
  const gymValidation = validateGymId(user);

  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedReport, setSelectedReport] = useState("overall-members");

  useEffect(() => {
    if (userIsAdmin) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [currentGymId, userIsAdmin]);

  const fetchData = async () => {
    if (!currentGymId) {
      setLoading(false);
      return;
    }

    try {
      const { db } = await import("../config/firebase");
      const { collection, getDocs, query, where } = await import("firebase/firestore");

      // Fetch members
      const membersRef = collection(db, "members");
      const membersQuery = query(membersRef, where("gymId", "==", currentGymId));
      const membersSnapshot = await getDocs(membersQuery);
      const membersData = membersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMembers(membersData);

      // Fetch payments
      const paymentsRef = collection(db, "payments");
      const paymentsQuery = query(paymentsRef, where("gymId", "==", currentGymId));
      const paymentsSnapshot = await getDocs(paymentsQuery);
      const paymentsData = paymentsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPayments(paymentsData);

      // Fetch attendance
      const attendanceRef = collection(db, "attendance");
      const attendanceQuery = query(attendanceRef, where("gymId", "==", currentGymId));
      const attendanceSnapshot = await getDocs(attendanceQuery);
      const attendanceData = attendanceSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setAttendance(attendanceData);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      showError("Failed to load data for reports");
      setLoading(false);
    }
  };

  const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) {
      showError("No data to export");
      return;
    }

    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            if (value === null || value === undefined) return "";
            if (typeof value === "string" && value.includes(",")) {
              return `"${value}"`;
            }
            return value;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
    showSuccess("Report exported successfully");
  };

  const generateOverallMembersList = () => {
    const data = members.map((member) => ({
      "Member Number": member.id.slice(-6).toUpperCase(),
      Name: member.name,
      Email: member.email || "N/A",
      Mobile: member.mobile || "N/A",
      Status: member.status || "N/A",
      "Join Date": member.joinDate ? new Date(member.joinDate).toLocaleDateString() : "N/A",
      Level: member.level || "N/A",
      "Membership Fee": member.membershipFee || 0,
    }));
    exportToCSV(data, "overall-member-list");
  };

  const generateMonthlyActiveMembers = () => {
    const [year, month] = selectedMonth.split("-");
    const startDate = new Date(year, parseInt(month) - 1, 1);
    const endDate = new Date(year, parseInt(month), 0);

    const monthAttendance = attendance.filter((record) => {
      const recordDate = new Date(record.date || record.checkInTime);
      return recordDate >= startDate && recordDate <= endDate;
    });

    const activeMemberIds = new Set(monthAttendance.map((r) => r.memberId));
    const activeMembersAttendance = members
      .filter((m) => activeMemberIds.has(m.id))
      .map((member) => {
        const memberAttendance = monthAttendance.filter((a) => a.memberId === member.id);
        return {
          "Member Number": member.id.slice(-6).toUpperCase(),
          Name: member.name,
          "Attendance Count": memberAttendance.length,
          Status: member.status,
          Email: member.email || "N/A",
        };
      });

    exportToCSV(activeMembersAttendance, `active-members-${selectedMonth}`);
  };

  const generateAttendanceReport = () => {
    const [year, month] = selectedMonth.split("-");
    const startDate = new Date(year, parseInt(month) - 1, 1);
    const endDate = new Date(year, parseInt(month), 0);

    const monthAttendance = attendance.filter((record) => {
      const recordDate = new Date(record.date || record.checkInTime);
      return recordDate >= startDate && recordDate <= endDate;
    });

    const attendanceByMember = {};
    const attendanceByDate = {};

    monthAttendance.forEach((record) => {
      const date = new Date(record.date || record.checkInTime).toLocaleDateString();
      const memberId = record.memberId;

      if (!attendanceByMember[memberId]) {
        attendanceByMember[memberId] = { count: 0, dates: [] };
      }
      attendanceByMember[memberId].count++;
      attendanceByMember[memberId].dates.push(date);

      if (!attendanceByDate[date]) {
        attendanceByDate[date] = 0;
      }
      attendanceByDate[date]++;
    });

    const data = Object.keys(attendanceByMember).map((memberId) => {
      const member = members.find((m) => m.id === memberId);
      return {
        "Member Number": memberId.slice(-6).toUpperCase(),
        "Member Name": member?.name || "N/A",
        "Total Days": attendanceByMember[memberId].count,
        "Last Attendance": attendanceByMember[memberId].dates[attendanceByMember[memberId].dates.length - 1] || "N/A",
      };
    });

    exportToCSV(data, `attendance-report-${selectedMonth}`);
  };

  const generateMonthlyPaymentReport = () => {
    const [year, month] = selectedMonth.split("-");

    const monthPayments = payments.filter((payment) => {
      const paymentDate = new Date(payment.paidAt || payment.createdAt);
      return (
        paymentDate.getFullYear() === parseInt(year) &&
        paymentDate.getMonth() === parseInt(month) - 1
      );
    });

    const data = monthPayments.map((payment) => ({
      "Payment ID": payment.id.slice(-6).toUpperCase(),
      "Member Name": payment.memberName || "N/A",
      Amount: payment.amount || 0,
      Month: payment.month || selectedMonth,
      "Payment Method": payment.paymentMethod || "N/A",
      "Paid Date": payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : "N/A",
      Notes: payment.notes || "N/A",
    }));

    const summary = {
      "Total Amount": data.reduce((sum, p) => sum + (p.Amount || 0), 0),
      "Total Payments": data.length,
    };

    exportToCSV([{ ...summary }, ...data], `monthly-payments-${selectedMonth}`);
  };

  const generatePendingPaymentReport = () => {
    const [year, month] = selectedMonth.split("-");
    const currentMonth = new Date(`${year}-${month}-01`);

    const pendingPayments = members.map((member) => {
      const nextPaymentDate = member.nextPaymentDate
        ? new Date(member.nextPaymentDate)
        : new Date(member.joinDate).getTime() > 0
        ? new Date(member.joinDate)
        : null;

      const isPending = nextPaymentDate && nextPaymentDate <= currentMonth;

      if (isPending && member.status === "active") {
        return {
          "Member Number": member.id.slice(-6).toUpperCase(),
          Name: member.name,
          "Due Date": nextPaymentDate?.toLocaleDateString() || "N/A",
          "Package Fee": member.membershipFee || 0,
          "Package Duration": member.packageDuration || 1,
          Email: member.email || "N/A",
          Mobile: member.mobile || "N/A",
        };
      }
      return null;
    }).filter(Boolean);

    exportToCSV(pendingPayments, `pending-payments-${selectedMonth}`);
  };

  const generateOverallPaymentReport = () => {
    const data = payments.map((payment) => ({
      "Payment ID": payment.id.slice(-6).toUpperCase(),
      "Member Name": payment.memberName || "N/A",
      Amount: payment.amount || 0,
      Month: payment.month || "N/A",
      "Payment Method": payment.paymentMethod || "N/A",
      "Paid Date": payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : "N/A",
    }));

    const summary = {
      "Total Revenue": data.reduce((sum, p) => sum + (p.Amount || 0), 0),
      "Total Transactions": data.length,
      "Average Payment": (data.reduce((sum, p) => sum + (p.Amount || 0), 0) / data.length).toFixed(2),
    };

    exportToCSV([{ ...summary }, ...data], "overall-payment-report");
  };

  const generateInactiveMemberReport = () => {
    const inactiveMembers = members.filter((m) => m.status === "inactive");
    const data = inactiveMembers.map((member) => ({
      "Member Number": member.id.slice(-6).toUpperCase(),
      Name: member.name,
      Email: member.email || "N/A",
      Mobile: member.mobile || "N/A",
      "Join Date": member.joinDate ? new Date(member.joinDate).toLocaleDateString() : "N/A",
      Level: member.level || "N/A",
      "Membership Fee": member.membershipFee || 0,
      Status: "Inactive",
    }));

    exportToCSV(data, "inactive-members-report");
  };

  const handleExportReport = () => {
    switch (selectedReport) {
      case "overall-members":
        generateOverallMembersList();
        break;
      case "monthly-active":
        generateMonthlyActiveMembers();
        break;
      case "attendance":
        generateAttendanceReport();
        break;
      case "monthly-payment":
        generateMonthlyPaymentReport();
        break;
      case "pending-payment":
        generatePendingPaymentReport();
        break;
      case "overall-payment":
        generateOverallPaymentReport();
        break;
      case "inactive":
        generateInactiveMemberReport();
        break;
      default:
        showError("Invalid report type");
    }
  };

  if (!userIsAdmin) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400">You don't have permission to access reports.</p>
        </div>
      </div>
    );
  }

  if (!gymValidation.isValid) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold text-white mb-2">Configuration Error</h2>
          <p className="text-gray-400">{gymValidation.error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading reports...</p>
        </div>
      </div>
    );
  }

  const reportOptions = [
    { value: "overall-members", label: "Overall Member List", description: "All members with names and IDs" },
    { value: "monthly-active", label: "Monthly Active Members", description: "Members active in selected month with attendance count" },
    { value: "attendance", label: "Attendance Report", description: "Attendance records by member and date" },
    { value: "monthly-payment", label: "Monthly Payment Report", description: "Payments received in selected month" },
    { value: "pending-payment", label: "Pending Payment Report", description: "Members with pending payments" },
    { value: "overall-payment", label: "Overall Payment Report", description: "All payment transactions" },
    { value: "inactive", label: "Inactive Members Report", description: "All inactive members" },
  ];

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900 flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="bg-gray-800 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Reports</h1>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Generate Reports</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Select Report</label>
                  <select
                    value={selectedReport}
                    onChange={(e) => setSelectedReport(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {reportOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {["monthly-active", "attendance", "monthly-payment", "pending-payment"].includes(selectedReport) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Select Month</label>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
                <p className="text-gray-300 text-sm">
                  {reportOptions.find((r) => r.value === selectedReport)?.description}
                </p>
              </div>

              <button
                onClick={handleExportReport}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export as CSV
              </button>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-bold text-white mb-4">Report Statistics</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gray-900 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Total Members</div>
                  <div className="text-2xl font-bold text-white">{members.length}</div>
                </div>
                <div className="bg-gray-900 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Active Members</div>
                  <div className="text-2xl font-bold text-green-600">
                    {members.filter((m) => m.status === "active").length}
                  </div>
                </div>
                <div className="bg-gray-900 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Inactive Members</div>
                  <div className="text-2xl font-bold text-red-600">
                    {members.filter((m) => m.status === "inactive").length}
                  </div>
                </div>
                <div className="bg-gray-900 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Total Payments</div>
                  <div className="text-2xl font-bold text-blue-600">
                    Rs. {payments.reduce((sum, p) => sum + (p.amount || 0), 0)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Reports;
