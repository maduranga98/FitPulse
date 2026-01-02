/**
 * Data Validation Utility Functions
 * Provides standardized validation for common data types
 */

/**
 * Validate BMI calculation inputs
 * @param {number} weight - Weight in kg
 * @param {number} height - Height in cm
 * @returns {Object} { isValid: boolean, errors: Array<string> }
 */
export const validateBMIInputs = (weight, height) => {
  const errors = [];
  const weightNum = parseFloat(weight);
  const heightNum = parseFloat(height);

  // Check if values are numbers
  if (isNaN(weightNum) || isNaN(heightNum)) {
    errors.push('Weight and height must be valid numbers');
    return { isValid: false, errors };
  }

  // Validate weight (reasonable range: 20-500 kg)
  if (weightNum <= 0) {
    errors.push('Weight must be greater than 0');
  } else if (weightNum < 20) {
    errors.push('Weight seems too low. Please verify (minimum 20 kg)');
  } else if (weightNum > 500) {
    errors.push('Weight seems too high. Please verify (maximum 500 kg)');
  }

  // Validate height (reasonable range: 50-300 cm)
  if (heightNum <= 0) {
    errors.push('Height must be greater than 0');
  } else if (heightNum < 50) {
    errors.push('Height seems too low. Please verify (minimum 50 cm)');
  } else if (heightNum > 300) {
    errors.push('Height seems too high. Please verify (maximum 300 cm)');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Calculate BMI with validation
 * @param {number} weight - Weight in kg
 * @param {number} height - Height in cm
 * @returns {Object|null} { bmi: number, category: string, color: string } or null if invalid
 */
export const calculateBMI = (weight, height) => {
  const validation = validateBMIInputs(weight, height);

  if (!validation.isValid) {
    console.warn('BMI calculation failed:', validation.errors);
    return null;
  }

  const weightKg = parseFloat(weight);
  const heightM = parseFloat(height) / 100;

  const bmi = (weightKg / (heightM * heightM)).toFixed(1);
  let category = '';
  let color = '';

  if (bmi < 18.5) {
    category = 'Underweight';
    color = 'text-blue-600';
  } else if (bmi >= 18.5 && bmi < 25) {
    category = 'Normal weight';
    color = 'text-green-600';
  } else if (bmi >= 25 && bmi < 30) {
    category = 'Overweight';
    color = 'text-yellow-600';
  } else {
    category = 'Obese';
    color = 'text-red-600';
  }

  return { bmi: parseFloat(bmi), category, color };
};

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean}
 */
export const isValidEmail = (email) => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number format (basic validation)
 * @param {string} phone - Phone number
 * @returns {boolean}
 */
export const isValidPhone = (phone) => {
  if (!phone) return false;
  // Remove common separators
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  // Check if it's at least 10 digits
  return /^\+?\d{10,}$/.test(cleaned);
};

/**
 * Validate age
 * @param {number} age - Age in years
 * @returns {Object} { isValid: boolean, error: string|null }
 */
export const validateAge = (age) => {
  const ageNum = parseInt(age);

  if (isNaN(ageNum)) {
    return { isValid: false, error: 'Age must be a valid number' };
  }

  if (ageNum < 1) {
    return { isValid: false, error: 'Age must be at least 1' };
  }

  if (ageNum > 150) {
    return { isValid: false, error: 'Age must be less than 150' };
  }

  if (ageNum < 13) {
    return { isValid: true, warning: 'Member is a minor. Ensure parental consent is obtained.' };
  }

  return { isValid: true, error: null };
};

/**
 * Sanitize string input to prevent XSS
 * @param {string} input - Input string
 * @returns {string}
 */
export const sanitizeInput = (input) => {
  if (!input) return '';
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};
