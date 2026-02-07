import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import MemberLayout from "../../components/MemberLayout";
import {
  Calendar,
  Plus,
  Trash2,
  Droplet,
  Utensils,
  PieChart,
  TrendingUp,
  X,
  Save,
} from "lucide-react";

const MemberNutrition = () => {
  const { user: currentUser } = useAuth();

  const [mealLogs, setMealLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [showAddMealModal, setShowAddMealModal] = useState(false);
  const [waterIntake, setWaterIntake] = useState(0);

  const [mealForm, setMealForm] = useState({
    mealType: "breakfast",
    foods: [
      {
        name: "",
        calories: 0,
        protein: 0,
        carbs: 0,
        fats: 0,
        quantity: 1,
      },
    ],
  });

  const mealTypes = ["breakfast", "lunch", "dinner", "snack"];

  useEffect(() => {
    if (currentUser?.id) {
      fetchData();
    }
  }, [currentUser?.id, selectedDate]);

  const fetchData = async () => {
    try {
      const { db } = await import("../../config/firebase");
      const { collection, query, where, getDocs } = await import("firebase/firestore");

      // Fetch meal logs for selected date
      const mealQuery = query(
        collection(db, "mealPlans"),
        where("memberId", "==", currentUser.id),
        where("date", "==", selectedDate)
      );
      const mealSnapshot = await getDocs(mealQuery);
      const mealData = mealSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      if (mealData.length > 0) {
        setMealLogs(mealData[0].meals || []);
        setWaterIntake(mealData[0].waterIntake || 0);
      } else {
        setMealLogs([]);
        setWaterIntake(0);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const handleAddMeal = async (e) => {
    e.preventDefault();

    try {
      const { db } = await import("../../config/firebase");
      const { collection, query, where, getDocs, addDoc, updateDoc, doc, Timestamp } =
        await import("firebase/firestore");

      // Calculate totals for the meal
      const mealTotals = mealForm.foods.reduce(
        (acc, food) => ({
          calories: acc.calories + food.calories * food.quantity,
          protein: acc.protein + food.protein * food.quantity,
          carbs: acc.carbs + food.carbs * food.quantity,
          fats: acc.fats + food.fats * food.quantity,
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 }
      );

      const newMeal = {
        mealType: mealForm.mealType,
        foods: mealForm.foods,
        ...mealTotals,
        loggedAt: Timestamp.now(),
      };

      // Check if meal plan exists for today
      const mealQuery = query(
        collection(db, "mealPlans"),
        where("memberId", "==", currentUser.id),
        where("date", "==", selectedDate)
      );
      const mealSnapshot = await getDocs(mealQuery);

      if (mealSnapshot.empty) {
        // Create new meal plan
        const updatedMeals = [newMeal];
        const dayTotals = calculateDayTotals(updatedMeals);

        await addDoc(collection(db, "mealPlans"), {
          memberId: currentUser.id,
          gymId: currentUser.gymId,
          date: selectedDate,
          meals: updatedMeals,
          ...dayTotals,
          waterIntake: waterIntake,
          createdAt: Timestamp.now(),
        });
      } else {
        // Update existing meal plan
        const existingDoc = mealSnapshot.docs[0];
        const existingMeals = existingDoc.data().meals || [];
        const updatedMeals = [...existingMeals, newMeal];
        const dayTotals = calculateDayTotals(updatedMeals);

        await updateDoc(doc(db, "mealPlans", existingDoc.id), {
          meals: updatedMeals,
          ...dayTotals,
          updatedAt: Timestamp.now(),
        });
      }

      setShowAddMealModal(false);
      setMealForm({
        mealType: "breakfast",
        foods: [{ name: "", calories: 0, protein: 0, carbs: 0, fats: 0, quantity: 1 }],
      });
      fetchData();
      alert("Meal added successfully! 🍽️");
    } catch (error) {
      console.error("Error adding meal:", error);
      alert("Failed to add meal. Please try again.");
    }
  };

  const handleDeleteMeal = async (mealIndex) => {
    if (!confirm("Are you sure you want to delete this meal?")) {
      return;
    }

    try {
      const { db } = await import("../../config/firebase");
      const { collection, query, where, getDocs, updateDoc, doc } = await import(
        "firebase/firestore"
      );

      const mealQuery = query(
        collection(db, "mealPlans"),
        where("memberId", "==", currentUser.id),
        where("date", "==", selectedDate)
      );
      const mealSnapshot = await getDocs(mealQuery);

      if (!mealSnapshot.empty) {
        const existingDoc = mealSnapshot.docs[0];
        const updatedMeals = mealLogs.filter((_, index) => index !== mealIndex);
        const dayTotals = calculateDayTotals(updatedMeals);

        await updateDoc(doc(db, "mealPlans", existingDoc.id), {
          meals: updatedMeals,
          ...dayTotals,
        });

        fetchData();
        alert("Meal deleted successfully.");
      }
    } catch (error) {
      console.error("Error deleting meal:", error);
      alert("Failed to delete meal. Please try again.");
    }
  };

  const handleUpdateWater = async (newValue) => {
    try {
      const { db } = await import("../../config/firebase");
      const { collection, query, where, getDocs, updateDoc, doc, addDoc, Timestamp } =
        await import("firebase/firestore");

      const mealQuery = query(
        collection(db, "mealPlans"),
        where("memberId", "==", currentUser.id),
        where("date", "==", selectedDate)
      );
      const mealSnapshot = await getDocs(mealQuery);

      if (mealSnapshot.empty) {
        // Create new meal plan with just water intake
        await addDoc(collection(db, "mealPlans"), {
          memberId: currentUser.id,
          gymId: currentUser.gymId,
          date: selectedDate,
          meals: [],
          totalCalories: 0,
          totalProtein: 0,
          totalCarbs: 0,
          totalFats: 0,
          waterIntake: newValue,
          createdAt: Timestamp.now(),
        });
      } else {
        await updateDoc(doc(db, "mealPlans", mealSnapshot.docs[0].id), {
          waterIntake: newValue,
        });
      }

      setWaterIntake(newValue);
    } catch (error) {
      console.error("Error updating water intake:", error);
    }
  };

  const calculateDayTotals = (meals) => {
    return meals.reduce(
      (acc, meal) => ({
        totalCalories: acc.totalCalories + (meal.calories || 0),
        totalProtein: acc.totalProtein + (meal.protein || 0),
        totalCarbs: acc.totalCarbs + (meal.carbs || 0),
        totalFats: acc.totalFats + (meal.fats || 0),
      }),
      { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFats: 0 }
    );
  };

  const getDayTotals = () => {
    return calculateDayTotals(mealLogs);
  };

  const addFoodRow = () => {
    setMealForm({
      ...mealForm,
      foods: [
        ...mealForm.foods,
        { name: "", calories: 0, protein: 0, carbs: 0, fats: 0, quantity: 1 },
      ],
    });
  };

  const removeFoodRow = (index) => {
    setMealForm({
      ...mealForm,
      foods: mealForm.foods.filter((_, i) => i !== index),
    });
  };

  const updateFoodRow = (index, field, value) => {
    const updatedFoods = [...mealForm.foods];
    updatedFoods[index] = {
      ...updatedFoods[index],
      [field]: field === "name" ? value : parseFloat(value) || 0,
    };
    setMealForm({ ...mealForm, foods: updatedFoods });
  };

  const getMealsByType = (type) => {
    return mealLogs.filter((meal) => meal.mealType === type);
  };

  const dayTotals = getDayTotals();
  const targetCalories = 2000; // This could be fetched from user profile
  const calorieProgress = ((dayTotals.totalCalories / targetCalories) * 100).toFixed(0);

  if (loading) {
    return (
      <MemberLayout>
        <div className="h-full flex items-center justify-center p-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading nutrition data...</p>
          </div>
        </div>
      </MemberLayout>
    );
  }

  return (
    <MemberLayout>
      <div className="min-h-full bg-gray-900">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-4 sm:p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                  Nutrition Tracker
                </h1>
                <p className="text-sm sm:text-base text-white/80">
                  Track your meals and macros
                </p>
              </div>
              <button
                onClick={() => setShowAddMealModal(true)}
                className="w-full sm:w-auto px-4 sm:px-6 py-3 bg-white text-green-600 rounded-lg font-medium hover:bg-gray-100 transition flex items-center justify-center gap-2 active:scale-95"
              >
                <Plus className="w-5 h-5" />
                <span>Log Meal</span>
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto p-4 sm:p-6">
          {/* Date Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Select Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Daily Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 sm:p-6 text-white">
              <div className="flex items-center gap-2 mb-2">
                <PieChart className="w-5 h-5" />
                <p className="text-xs sm:text-sm text-blue-100">Calories</p>
              </div>
              <div className="text-2xl sm:text-3xl font-bold mb-1">
                {dayTotals.totalCalories.toFixed(0)}
              </div>
              <div className="text-xs text-blue-100">/ {targetCalories} kcal</div>
              <div className="mt-2 bg-blue-800/50 rounded-full h-1.5">
                <div
                  className="bg-white h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min(calorieProgress, 100)}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-xl p-4 sm:p-6 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Utensils className="w-5 h-5" />
                <p className="text-xs sm:text-sm text-red-100">Protein</p>
              </div>
              <div className="text-2xl sm:text-3xl font-bold mb-1">
                {dayTotals.totalProtein.toFixed(1)}g
              </div>
              <div className="text-xs text-red-100">Essential macros</div>
            </div>

            <div className="bg-gradient-to-br from-yellow-600 to-orange-600 rounded-xl p-4 sm:p-6 text-white">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5" />
                <p className="text-xs sm:text-sm text-yellow-100">Carbs</p>
              </div>
              <div className="text-2xl sm:text-3xl font-bold mb-1">
                {dayTotals.totalCarbs.toFixed(1)}g
              </div>
              <div className="text-xs text-yellow-100">Energy source</div>
            </div>

            <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-4 sm:p-6 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Droplet className="w-5 h-5" />
                <p className="text-xs sm:text-sm text-purple-100">Fats</p>
              </div>
              <div className="text-2xl sm:text-3xl font-bold mb-1">
                {dayTotals.totalFats.toFixed(1)}g
              </div>
              <div className="text-xs text-purple-100">Healthy fats</div>
            </div>
          </div>

          {/* Water Intake */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 sm:p-6 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Droplet className="w-5 h-5 text-blue-400" />
                <h3 className="text-base sm:text-lg font-bold text-white">Water Intake</h3>
              </div>
              <span className="text-xl sm:text-2xl font-bold text-blue-400">{waterIntake} glasses</span>
            </div>
            <div className="grid grid-cols-4 sm:flex gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((glass) => (
                <button
                  key={glass}
                  onClick={() => handleUpdateWater(glass)}
                  className={`h-12 sm:flex-1 rounded-lg transition active:scale-95 ${
                    waterIntake >= glass
                      ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white"
                      : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                  }`}
                >
                  <Droplet className="w-4 h-4 sm:w-5 sm:h-5 mx-auto" />
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">
              Target: 8 glasses (2 liters) per day
            </p>
          </div>

          {/* Meals */}
          <div className="bg-gray-800 rounded-xl border border-gray-700">
            <div className="p-4 sm:p-6 border-b border-gray-700">
              <h3 className="text-lg sm:text-xl font-bold text-white">Today's Meals</h3>
            </div>

            <div className="p-4 sm:p-6">
              {mealTypes.map((mealType) => {
                const meals = getMealsByType(mealType);
                return (
                  <div key={mealType} className="mb-6 last:mb-0">
                    <h4 className="text-md font-bold text-white mb-3 capitalize">
                      {mealType}
                    </h4>
                    {meals.length > 0 ? (
                      <div className="space-y-3">
                        {meals.map((meal, index) => {
                          const mealIndex = mealLogs.indexOf(meal);
                          return (
                            <div
                              key={mealIndex}
                              className="bg-gray-900 rounded-lg p-4 border border-gray-700"
                            >
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="flex-1">
                                  {meal.foods?.map((food, foodIndex) => (
                                    <div key={foodIndex} className="mb-2 last:mb-0">
                                      <p className="text-white font-medium">
                                        {food.name} {food.quantity > 1 && `(x${food.quantity})`}
                                      </p>
                                      <p className="text-xs text-gray-400">
                                        {(food.calories * food.quantity).toFixed(0)} cal | P:{" "}
                                        {(food.protein * food.quantity).toFixed(1)}g | C:{" "}
                                        {(food.carbs * food.quantity).toFixed(1)}g | F:{" "}
                                        {(food.fats * food.quantity).toFixed(1)}g
                                      </p>
                                    </div>
                                  ))}
                                </div>
                                <button
                                  onClick={() => handleDeleteMeal(mealIndex)}
                                  className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="pt-3 border-t border-gray-700 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                                <div>
                                  <p className="text-xs text-gray-400">Calories</p>
                                  <p className="text-sm font-bold text-white">
                                    {meal.calories?.toFixed(0)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400">Protein</p>
                                  <p className="text-sm font-bold text-white">
                                    {meal.protein?.toFixed(1)}g
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400">Carbs</p>
                                  <p className="text-sm font-bold text-white">
                                    {meal.carbs?.toFixed(1)}g
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400">Fats</p>
                                  <p className="text-sm font-bold text-white">
                                    {meal.fats?.toFixed(1)}g
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="bg-gray-900 rounded-lg p-4 border border-gray-700 text-center">
                        <p className="text-gray-400 text-sm">No meals logged</p>
                      </div>
                    )}
                  </div>
                );
              })}

              {mealLogs.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🍽️</div>
                  <h3 className="text-xl font-bold text-white mb-2">No Meals Logged</h3>
                  <p className="text-gray-400 mb-6">
                    Start tracking your nutrition by logging your first meal!
                  </p>
                  <button
                    onClick={() => setShowAddMealModal(true)}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-medium transition active:scale-95"
                  >
                    Log Your First Meal
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Add Meal Modal */}
        {showAddMealModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-gray-800 rounded-xl max-w-3xl w-full p-4 sm:p-6 my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-white">Log Meal</h2>
                <button
                  onClick={() => setShowAddMealModal(false)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAddMeal} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Meal Type *
                  </label>
                  <select
                    value={mealForm.mealType}
                    onChange={(e) => setMealForm({ ...mealForm, mealType: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  >
                    {mealTypes.map((type) => (
                      <option key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-300">Foods *</label>
                    <button
                      type="button"
                      onClick={addFoodRow}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition"
                    >
                      + Add Food
                    </button>
                  </div>

                  <div className="space-y-3">
                    {mealForm.foods.map((food, index) => (
                      <div key={index} className="bg-gray-900 rounded-lg p-3 sm:p-4 border border-gray-700">
                        <div className="space-y-2 mb-3">
                          <input
                            type="text"
                            placeholder="Food name"
                            value={food.name}
                            onChange={(e) => updateFoodRow(index, "name", e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            required
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              placeholder="Calories"
                              value={food.calories || ""}
                              onChange={(e) => updateFoodRow(index, "calories", e.target.value)}
                              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                              min="0"
                              step="1"
                              required
                            />
                            <input
                              type="number"
                              placeholder="Protein (g)"
                              value={food.protein || ""}
                              onChange={(e) => updateFoodRow(index, "protein", e.target.value)}
                              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                              min="0"
                              step="0.1"
                            />
                            <input
                              type="number"
                              placeholder="Carbs (g)"
                              value={food.carbs || ""}
                              onChange={(e) => updateFoodRow(index, "carbs", e.target.value)}
                              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                              min="0"
                              step="0.1"
                            />
                            <input
                              type="number"
                              placeholder="Fats (g)"
                              value={food.fats || ""}
                              onChange={(e) => updateFoodRow(index, "fats", e.target.value)}
                              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                              min="0"
                              step="0.1"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-400">Quantity:</label>
                            <input
                              type="number"
                              value={food.quantity}
                              onChange={(e) => updateFoodRow(index, "quantity", e.target.value)}
                              className="w-20 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                              min="0.1"
                              step="0.1"
                              required
                            />
                          </div>
                          {mealForm.foods.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeFoodRow(index)}
                              className="text-red-400 hover:text-red-300 text-sm"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddMealModal(false)}
                    className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Log Meal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </MemberLayout>
  );
};

export default MemberNutrition;
