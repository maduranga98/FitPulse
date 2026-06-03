import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import MemberAvatar from "../../components/MemberAvatar";
import {
  Users,
  Search,
  Eye,
  X,
  Calendar,
  Dumbbell,
  CheckCircle,
  Clock,
  Mail,
  Phone,
} from "lucide-react";

const InstructorMembers = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const currentGymId = user?.gymId;

  // State management
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Assignments data
  const [memberAssignments, setMemberAssignments] = useState({});
  const [memberWorkouts, setMemberWorkouts] = useState({});

  useEffect(() => {
    if (currentGymId && user?.id) {
      fetchData();
    }
  }, [currentGymId, user?.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { db } = await import("../../config/firebase");
      const { collection, getDocs, query, where } = await import(
        "firebase/firestore"
      );

      // Fetch active members
      const membersSnapshot = await getDocs(
        query(
          collection(db, "members"),
          where("gymId", "==", currentGymId),
          where("status", "==", "active")
        )
      );
      const membersData = membersSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((m) => !m.role || m.role === "member");

      // Fetch all exercise assignments for this gym
      const exerciseAssignmentsSnapshot = await getDocs(
        query(
          collection(db, "exercise_assignments"),
          where("gymId", "==", currentGymId)
        )
      );

      // Group assignments by member
      const assignmentsByMember = {};
      exerciseAssignmentsSnapshot.docs.forEach((doc) => {
        const assignment = { id: doc.id, ...doc.data() };
        const memberId = assignment.memberId;
        if (!assignmentsByMember[memberId]) {
          assignmentsByMember[memberId] = [];
        }
        assignmentsByMember[memberId].push(assignment);
      });

      // Fetch all workout assignments for this gym
      const workoutAssignmentsSnapshot = await getDocs(
        query(
          collection(db, "workout_assignments"),
          where("gymId", "==", currentGymId)
        )
      );

      // Group workout assignments by member
      const workoutsByMember = {};
      workoutAssignmentsSnapshot.docs.forEach((doc) => {
        const workout = { id: doc.id, ...doc.data() };
        const memberId = workout.memberId;
        if (!workoutsByMember[memberId]) {
          workoutsByMember[memberId] = [];
        }
        workoutsByMember[memberId].push(workout);
      });

      setMembers(membersData);
      setMemberAssignments(assignmentsByMember);
      setMemberWorkouts(workoutsByMember);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      alert(`Error loading data: ${error.message}`);
      setLoading(false);
    }
  };

  const getMemberStats = (memberId) => {
    const exercises = memberAssignments[memberId] || [];
    const workouts = memberWorkouts[memberId] || [];
    
    return {
      totalExercises: exercises.length,
      totalWorkouts: workouts.length,
      completedExercises: exercises.filter(e => e.status === "completed").length,
      completedWorkouts: workouts.filter(w => w.status === "completed").length,
    };
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "bg-green-500/20 text-green-400 border-green-500";
      case "in_progress":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500";
      case "pending":
      case "assigned":
        return "bg-blue-500/20 text-blue-400 border-blue-500";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500";
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const calculateBMI = (weight, height) => {
    if (!weight || !height || height === 0) return null;
    // BMI = weight (kg) / (height (m))^2
    const heightInMeters = height / 100; // Convert cm to meters
    const bmi = weight / (heightInMeters * heightInMeters);
    return bmi.toFixed(1);
  };

  const getBMICategory = (bmi) => {
    if (!bmi) return null;
    if (bmi < 18.5) return { label: "Underweight", color: "text-blue-400" };
    if (bmi < 25) return { label: "Normal", color: "text-green-400" };
    if (bmi < 30) return { label: "Overweight", color: "text-yellow-400" };
    return { label: "Obese", color: "text-red-400" };
  };

  const filteredMembers = members.filter((member) =>
    (member?.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (member?.email || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading members...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-white flex items-center gap-3">
                <Users className="w-10 h-10 text-purple-400" />
                My Members
              </h1>
              <p className="text-gray-400 mt-2">
                View member details and track assigned exercises
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Members Grid */}
        {filteredMembers.length === 0 ? (
          <div className="text-center py-12 bg-gray-800/50 rounded-xl border border-gray-700">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">
              {searchTerm ? "No members found" : "No active members"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMembers.map((member) => {
              const stats = getMemberStats(member.id);
              return (
                <div
                  key={member.id}
                  className="bg-gray-800 rounded-xl border border-gray-700 p-6 hover:border-purple-500 transition"
                >
                  {/* Member Info */}
                  <div className="mb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <MemberAvatar name={member.name} imageUrl={member.profileImageUrl} sizeClass="w-10 h-10" textClass="text-base" />
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-white truncate">{member.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${member.level === "advanced" ? "bg-red-600/20 text-red-400" : member.level === "intermediate" ? "bg-yellow-600/20 text-yellow-400" : "bg-green-600/20 text-green-400"}`}>
                          {member.level || "beginner"}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {member.email && (
                        <p className="text-gray-400 text-sm flex items-center gap-2">
                          <Mail className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{member.email}</span>
                        </p>
                      )}
                      {(member.mobile || member.phone) && (
                        <p className="text-gray-400 text-sm flex items-center gap-2">
                          <Phone className="w-4 h-4 flex-shrink-0" />
                          {member.mobile || member.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-gray-900 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Dumbbell className="w-4 h-4 text-purple-400" />
                        <span className="text-gray-400 text-xs">Exercises</span>
                      </div>
                      <p className="text-white font-bold">
                        {stats.completedExercises}/{stats.totalExercises}
                      </p>
                    </div>
                    <div className="bg-gray-900 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4 text-blue-400" />
                        <span className="text-gray-400 text-xs">Workouts</span>
                      </div>
                      <p className="text-white font-bold">
                        {stats.completedWorkouts}/{stats.totalWorkouts}
                      </p>
                    </div>
                  </div>

                  {/* View Details Button */}
                  <button
                    onClick={() => {
                      setSelectedMember(member);
                      setShowDetailsModal(true);
                    }}
                    className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    View Details
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Member Details Modal */}
        {showDetailsModal && selectedMember && (
          <div className="fixed inset-0 bg-black/80 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-gray-800 rounded-xl max-w-4xl w-full p-4 sm:p-6 my-4 sm:my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl sm:text-2xl font-bold text-white truncate">
                    {selectedMember.name}
                  </h2>
                  <p className="text-gray-400 mt-1 text-sm truncate">{selectedMember.email}</p>
                </div>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedMember(null);
                  }}
                  className="text-gray-400 hover:text-white transition ml-4 flex-shrink-0"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Member Info */}
              <div className="space-y-4 mb-6">
                {/* Personal Information */}
                <div className="bg-gray-900 rounded-lg p-4">
                  <h3 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide text-gray-400">Personal Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { label: "Age", value: selectedMember.age ? `${selectedMember.age} yrs` : null },
                      { label: "Mobile", value: selectedMember.mobile || selectedMember.phone },
                      { label: "WhatsApp", value: selectedMember.whatsapp },
                      { label: "Email", value: selectedMember.email },
                      { label: "Level", value: selectedMember.level ? selectedMember.level.charAt(0).toUpperCase() + selectedMember.level.slice(1) : null },
                      { label: "Status", value: selectedMember.status ? selectedMember.status.charAt(0).toUpperCase() + selectedMember.status.slice(1) : null },
                    ].filter(f => f.value).map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-gray-500 text-xs">{label}</p>
                        <p className="text-white text-sm font-medium break-words">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Membership Details */}
                <div className="bg-gray-900 rounded-lg p-4">
                  <h3 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide text-gray-400">Membership</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { label: "Member Code", value: selectedMember.memberCode },
                      { label: "Join Date", value: selectedMember.joinDate ? formatDate(selectedMember.joinDate) : null },
                      { label: "Membership Fee", value: selectedMember.membershipFee ? `$${selectedMember.membershipFee}` : null },
                      { label: "Package Duration", value: selectedMember.packageDuration ? `${selectedMember.packageDuration} month(s)` : null },
                      { label: "Next Payment", value: selectedMember.nextPaymentDate },
                    ].filter(f => f.value).map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-gray-500 text-xs">{label}</p>
                        <p className="text-white text-sm font-medium">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Health Information */}
                <div className="bg-gray-900 rounded-lg p-4">
                  <h3 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide text-gray-400">Health & Body</h3>
                  {(selectedMember.height || selectedMember.weight) ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                      {selectedMember.height && (
                        <div>
                          <p className="text-gray-500 text-xs">Height</p>
                          <p className="text-white text-sm font-medium">{selectedMember.height} cm</p>
                        </div>
                      )}
                      {selectedMember.weight && (
                        <div>
                          <p className="text-gray-500 text-xs">Weight</p>
                          <p className="text-white text-sm font-medium">{selectedMember.weight} kg</p>
                        </div>
                      )}
                      {(selectedMember.weight && selectedMember.height) && (() => {
                        const bmi = calculateBMI(selectedMember.weight, selectedMember.height);
                        const cat = getBMICategory(parseFloat(bmi));
                        return (
                          <div>
                            <p className="text-gray-500 text-xs">BMI</p>
                            <p className="text-white text-sm font-medium">
                              {bmi} {cat && <span className={`text-xs ${cat.color}`}>({cat.label})</span>}
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-xs mb-3">No body measurements recorded</p>
                  )}
                  <div className="space-y-3">
                    <div className="pt-3 border-t border-gray-700">
                      <p className="text-gray-500 text-xs mb-1.5">Medical Conditions</p>
                      <p className="text-white text-sm">{selectedMember.diseases ? (Array.isArray(selectedMember.diseases) ? selectedMember.diseases.join(", ") : selectedMember.diseases) : "None"}</p>
                    </div>
                    <div className="pt-3 border-t border-gray-700">
                      <p className="text-gray-500 text-xs mb-1.5">Allergies</p>
                      <p className="text-white text-sm">{selectedMember.allergies ? (Array.isArray(selectedMember.allergies) ? selectedMember.allergies.join(", ") : selectedMember.allergies) : "None"}</p>
                    </div>
                    {selectedMember.bloodType && (
                      <div className="pt-3 border-t border-gray-700">
                        <p className="text-gray-500 text-xs mb-1.5">Blood Type</p>
                        <p className="text-white text-sm font-medium">{selectedMember.bloodType}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="bg-gray-900 rounded-lg p-4">
                  <h3 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide text-gray-400">Emergency Contact</h3>
                  {(selectedMember.emergencyName || selectedMember.emergencyContactName || selectedMember.emergencyContact || selectedMember.emergencyRelation) ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(selectedMember.emergencyName || selectedMember.emergencyContactName) && (
                        <div>
                          <p className="text-gray-500 text-xs">Name</p>
                          <p className="text-white text-sm font-medium">{selectedMember.emergencyName || selectedMember.emergencyContactName}</p>
                        </div>
                      )}
                      {selectedMember.emergencyContact && (
                        <div>
                          <p className="text-gray-500 text-xs">Phone</p>
                          <p className="text-white text-sm font-medium">{selectedMember.emergencyContact}</p>
                        </div>
                      )}
                      {selectedMember.emergencyRelation && (
                        <div>
                          <p className="text-gray-500 text-xs">Relationship</p>
                          <p className="text-white text-sm font-medium">{selectedMember.emergencyRelation}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No emergency contact recorded</p>
                  )}
                </div>

                {/* Notes */}
                {selectedMember.notes && (
                  <div className="bg-gray-900 rounded-lg p-4">
                    <h3 className="text-white font-semibold mb-2 text-sm uppercase tracking-wide text-gray-400">Notes</h3>
                    <p className="text-white text-sm">{selectedMember.notes}</p>
                  </div>
                )}
              </div>

              {/* Assigned Workout Templates */}
              <div className="mb-6">
                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  <span className="text-sm sm:text-base">Assigned Workout Templates (
                  {(memberWorkouts[selectedMember.id] || []).length})</span>
                </h3>
                {(memberWorkouts[selectedMember.id] || []).length === 0 ? (
                  <div className="bg-gray-900 rounded-lg p-6 text-center">
                    <p className="text-gray-400">No workout templates assigned</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                    {(memberWorkouts[selectedMember.id] || []).map((workout) => (
                      <div
                        key={workout.id}
                        className="bg-gray-900 rounded-lg p-4 border border-gray-700"
                      >
                        <div className="flex items-start justify-between mb-2 gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-white font-bold break-words">
                              {workout.templateName}
                            </h4>
                            <p className="text-gray-400 text-sm">
                              Assigned by {workout.assignedByName}
                            </p>
                          </div>
                          <span
                            className={`px-3 py-1 text-xs rounded-full border flex-shrink-0 ${getStatusColor(
                              workout.status
                            )}`}
                          >
                            {workout.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div>
                            <p className="text-gray-400 text-xs">Assigned</p>
                            <p className="text-white text-sm">
                              {formatDate(workout.assignedAt)}
                            </p>
                          </div>
                          {workout.dueDate && (
                            <div>
                              <p className="text-gray-400 text-xs">Due Date</p>
                              <p className="text-white text-sm">
                                {formatDate(workout.dueDate)}
                              </p>
                            </div>
                          )}
                        </div>
                        {workout.progress && (
                          <div className="mt-3 pt-3 border-t border-gray-700">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400 text-sm">Progress</span>
                              <span className="text-white text-sm font-bold">
                                {workout.progress.completedExercises}/
                                {workout.progress.totalExercises} exercises
                              </span>
                            </div>
                            <div className="mt-2 bg-gray-800 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full transition-all"
                                style={{
                                  width: `${
                                    (workout.progress.completedExercises /
                                      workout.progress.totalExercises) *
                                    100
                                  }%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assigned Individual Exercises */}
              <div>
                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                  <Dumbbell className="w-5 h-5 text-purple-400" />
                  <span className="text-sm sm:text-base">Assigned Individual Exercises (
                  {(memberAssignments[selectedMember.id] || []).length})</span>
                </h3>
                {(memberAssignments[selectedMember.id] || []).length === 0 ? (
                  <div className="bg-gray-900 rounded-lg p-6 text-center">
                    <p className="text-gray-400">No individual exercises assigned</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                    {(memberAssignments[selectedMember.id] || []).map(
                      (assignment) => (
                        <div
                          key={assignment.id}
                          className="bg-gray-900 rounded-lg p-4 border border-gray-700"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-white font-bold break-words">
                                {assignment.exerciseName}
                              </h4>
                              <p className="text-gray-400 text-sm">
                                Assigned by {assignment.assignedByName}
                              </p>
                              <p className="text-gray-500 text-xs mt-1">
                                {formatDate(assignment.assignedAt)}
                              </p>
                            </div>
                            <span
                              className={`px-3 py-1 text-xs rounded-full border flex-shrink-0 ${getStatusColor(
                                assignment.status
                              )}`}
                            >
                              {assignment.status}
                            </span>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* Close Button */}
              <div className="mt-6 sticky bottom-0 bg-gray-800 pt-4 -mx-4 sm:-mx-6 px-4 sm:px-6 -mb-4 sm:-mb-6 pb-4 sm:pb-6">
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedMember(null);
                  }}
                  className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default InstructorMembers;
