import React, { useState, useEffect } from 'react';
import { X, ChevronRight, Check, Layers, Loader } from 'lucide-react';
import { icd10HierarchyAPI } from '../services/api';

const ICD10HierarchySelector = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  initialCode = null,
  initialDescription = null 
}) => {
  const [hierarchy, setHierarchy] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [finalCode, setFinalCode] = useState(null);
  const [finalDescription, setFinalDescription] = useState(null);

  useEffect(() => {
    if (isOpen && initialCode) {
      loadHierarchy(initialCode);
    }
  }, [isOpen, initialCode]);

  const loadHierarchy = async (code) => {
    setLoading(true);
    try {
      const response = await icd10HierarchyAPI.getQuestions(code);
      
      if (response.data && response.data.questions && response.data.questions.length > 0) {
        setHierarchy(response.data);
        setAnswers({});
        setCurrentQuestionIndex(0);
        setFinalCode(null);
        setFinalDescription(null);
      } else {
        setHierarchy(null);
      }
    } catch (error) {
      console.error('Error loading hierarchy:', error);
      // If no hierarchy exists, use the code directly
      setHierarchy(null);
      if (initialCode && initialDescription) {
        setFinalCode(initialCode);
        setFinalDescription(initialDescription);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (questionIndex, answerValue, answerLabel) => {
    const question = hierarchy.questions[questionIndex];
    const newAnswers = { ...answers, [questionIndex]: { value: answerValue, label: answerLabel } };
    setAnswers(newAnswers);

    // Find the selected option
    const selectedOption = question.options.find(opt => opt.value === answerValue);
    
    // Build final code based on template
    let code = question.final_code_template || '{selected_value}';
    code = code.replace('{selected_value}', answerValue);
    code = code.replace('{parent_code}', hierarchy.parent_code);
    
    // Build full description from all answers
    const allAnswerLabels = Object.values(newAnswers).map(a => a.label);
    let fullDescription = initialDescription || hierarchy.parent_description || '';
    
    // If we have answers, build a comprehensive description
    if (allAnswerLabels.length > 0) {
      // Start with parent description
      fullDescription = hierarchy.parent_description || initialDescription || '';
      
      // Append all answer labels
      const answerParts = allAnswerLabels.filter(label => label && label.trim());
      if (answerParts.length > 0) {
        // If the answer is a full diagnosis description, use it; otherwise append
        if (/^[A-Z]\d/.test(answerValue) && answerLabel.length > 20) {
          // This looks like a full diagnosis, use it
          fullDescription = answerLabel;
        } else {
          // Build: "Parent Description - Answer1, Answer2, etc."
          const additionalInfo = answerParts.join(', ');
          if (additionalInfo && !fullDescription.includes(additionalInfo)) {
            fullDescription = `${fullDescription} - ${additionalInfo}`;
          }
        }
      }
    }
    
    // If this is a valid ICD-10 code (starts with letter and has numbers), use it
    if (/^[A-Z]\d/.test(answerValue)) {
      setFinalCode(answerValue);
      setFinalDescription(fullDescription);
    } else {
      setFinalCode(hierarchy.parent_code);
      setFinalDescription(fullDescription);
    }

    // Check if there's a next question
    const nextQuestion = findNextQuestion(questionIndex, answerValue, newAnswers);
    if (nextQuestion !== null && nextQuestion < hierarchy.questions.length) {
      setCurrentQuestionIndex(nextQuestion);
    }
    // If no next question, user can still confirm with current answers
  };

  const findNextQuestion = (currentIndex, answerValue, currentAnswers) => {
    if (!hierarchy || !hierarchy.questions) return null;
    
    // Look for next question that depends on current answer
    for (let i = currentIndex + 1; i < hierarchy.questions.length; i++) {
      const question = hierarchy.questions[i];
      if (question.depends_on && question.depends_on.parent_value) {
        const dependsOnValues = Array.isArray(question.depends_on.parent_value) 
          ? question.depends_on.parent_value 
          : [question.depends_on.parent_value];
        
        if (dependsOnValues.includes(answerValue)) {
          return i;
        }
        // If dependency doesn't match, continue looking
      } else {
        // No dependency, this is the next question
        return i;
      }
    }
    
    return null;
  };

  const finalizeSelection = (code, description) => {
    setFinalCode(code);
    setFinalDescription(description || initialDescription);
  };

  const handleConfirm = () => {
    if (finalCode) {
      // Build comprehensive description from all answers
      let comprehensiveDescription = hierarchy?.parent_description || initialDescription || '';
      
      // Collect all answer labels
      const answerLabels = Object.values(answers)
        .sort((a, b) => {
          // Sort by question order
          const aIndex = Object.keys(answers).find(key => answers[key] === a);
          const bIndex = Object.keys(answers).find(key => answers[key] === b);
          return parseInt(aIndex) - parseInt(bIndex);
        })
        .map(a => a.label)
        .filter(label => label && label.trim());
      
      // If we have a valid ICD-10 code from answers, use its description
      const validCodeAnswer = Object.values(answers).find(a => /^[A-Z]\d/.test(a.value));
      if (validCodeAnswer && validCodeAnswer.label.length > 20) {
        // This is a full diagnosis description
        comprehensiveDescription = validCodeAnswer.label;
      } else if (answerLabels.length > 0) {
        // Build: "Parent Description - Answer1, Answer2, etc."
        const additionalInfo = answerLabels.join(', ');
        if (additionalInfo && !comprehensiveDescription.includes(additionalInfo)) {
          comprehensiveDescription = `${comprehensiveDescription} - ${additionalInfo}`;
        }
      }
      
      onSelect({
        code: finalCode,
        description: comprehensiveDescription || finalDescription || initialDescription
      });
      handleClose();
    }
  };

  const handleClose = () => {
    setHierarchy(null);
    setAnswers({});
    setCurrentQuestionIndex(0);
    setFinalCode(null);
    setFinalDescription(null);
    onClose();
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      // Remove answer for current and subsequent questions
      const newAnswers = { ...answers };
      Object.keys(newAnswers).forEach(key => {
        if (parseInt(key) >= currentQuestionIndex - 1) {
          delete newAnswers[key];
        }
      });
      setAnswers(newAnswers);
    }
  };

  if (!isOpen) return null;

  const currentQuestion = hierarchy?.questions?.[currentQuestionIndex];
  const hasMoreQuestions = hierarchy && currentQuestionIndex < hierarchy.questions.length - 1;
  const canGoBack = currentQuestionIndex > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]" onClick={handleClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-green-50">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Refine Diagnosis</h3>
            </div>
            {hierarchy && (
              <p className="text-sm text-gray-600 mt-1">{hierarchy.parent_description}</p>
            )}
            {initialCode && (
              <p className="text-xs text-gray-500 mt-1 font-mono">{initialCode}</p>
            )}
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-8">
              <Loader className="w-8 h-8 text-primary-600 animate-spin mx-auto mb-2" />
              <p className="text-gray-500">Loading questions...</p>
            </div>
          ) : !hierarchy ? (
            <div className="text-center py-8">
              <p className="text-red-600 mb-2 font-semibold">⚠️ Failed to load hierarchy</p>
              <p className="text-gray-500 mb-4 text-sm">Check browser console (F12) for error details</p>
              {initialCode && initialDescription && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="font-semibold text-blue-900">{initialCode}</p>
                  <p className="text-sm text-blue-700">{initialDescription}</p>
                </div>
              )}
              <button
                onClick={() => {
                  if (initialCode) loadHierarchy(initialCode);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retry Loading Questions
              </button>
            </div>
          ) : !hierarchy.questions || hierarchy.questions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No questions configured for this diagnosis.</p>
              {initialCode && initialDescription && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="font-semibold text-blue-900">{initialCode}</p>
                  <p className="text-sm text-blue-700">{initialDescription}</p>
                </div>
              )}
            </div>
          ) : !currentQuestion ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No current question available.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Progress indicator */}
              <div className="flex items-center space-x-2">
                {hierarchy.questions.map((_, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 h-2 rounded ${
                      idx < currentQuestionIndex
                        ? 'bg-green-500'
                        : idx === currentQuestionIndex
                        ? 'bg-blue-500'
                        : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              
              {/* Current Question */}
              <div>
                <div className="mb-2">
                  <span className="text-xs text-gray-500">
                    Question {currentQuestionIndex + 1} of {hierarchy.questions.length}
                  </span>
                </div>
                <h4 className="text-base font-semibold text-gray-900 mb-4">
                  {currentQuestion.question_text}
                </h4>
                
                <div className="space-y-2">
                  {currentQuestion.options.map((option, optIdx) => (
                    <button
                      key={optIdx}
                      onClick={() => handleAnswer(currentQuestionIndex, option.value, option.label)}
                      className={`w-full text-left p-4 border-2 rounded-lg transition-all ${
                        answers[currentQuestionIndex]?.value === option.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">{option.label}</span>
                        {answers[currentQuestionIndex]?.value === option.value && (
                          <Check className="w-5 h-5 text-blue-500" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Answer Summary */}
              {Object.keys(answers).length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Selected:</p>
                  <div className="space-y-1">
                    {Object.entries(answers).map(([idx, answer]) => {
                      const q = hierarchy.questions[parseInt(idx)];
                      return (
                        <div key={idx} className="text-xs text-gray-600">
                          <span className="font-medium">{q.question_text}:</span> {answer.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Final Code Preview */}
              {finalCode && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-xs font-semibold text-green-900 mb-1">Final Diagnosis:</p>
                  <p className="font-mono font-semibold text-green-900">{finalCode}</p>
                  {finalDescription && (
                    <p className="text-sm text-green-700 mt-1">{finalDescription}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex gap-2">
            {canGoBack && (
              <button
                onClick={handleBack}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!finalCode}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Confirm
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ICD10HierarchySelector;

