/**
 * DoseSpot Embedded Prescribing Component
 * 
 * Displays DoseSpot prescribing UI in an embedded iFrame
 * with status polling and completion handling
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Loader, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import Modal from './ui/Modal';
import { eprescribeAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const DoseSpotPrescribe = ({ isOpen, onClose, patientId, patientName, onPrescriptionSent }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ssoUrl, setSsoUrl] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, loading, ready, error, completed
  const iframeRef = useRef(null);
  const statusPollIntervalRef = useRef(null);

  // Generate SSO URL when modal opens
  useEffect(() => {
    if (isOpen && patientId) {
      loadSSOUrl();
    } else {
      // Cleanup
      if (statusPollIntervalRef.current) {
        clearInterval(statusPollIntervalRef.current);
        statusPollIntervalRef.current = null;
      }
    }

    return () => {
      if (statusPollIntervalRef.current) {
        clearInterval(statusPollIntervalRef.current);
      }
    };
  }, [isOpen, patientId]);

  const loadSSOUrl = async () => {
    setLoading(true);
    setError(null);
    setStatus('loading');

    try {
      // Check if ePrescribing is enabled
      const statusResponse = await eprescribeAPI.getStatus();
      if (!statusResponse.data.enabled) {
        setError('E-prescribing is not enabled. Please contact your administrator.');
        setStatus('error');
        setLoading(false);
        return;
      }

      // Get return URL (current page)
      const returnUrl = window.location.href;

      // Create SSO session
      const response = await eprescribeAPI.createSession(patientId, returnUrl);
      const url = response.data.url || response.data.sso_url;

      if (!url) {
        throw new Error('No SSO URL returned from server');
      }

      setSsoUrl(url);
      setStatus('ready');
      setLoading(false);

      // Start polling for prescription status changes
      startStatusPolling();
    } catch (err) {
      console.error('Failed to load DoseSpot SSO URL:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load prescribing interface');
      setStatus('error');
      setLoading(false);
    }
  };

  const startStatusPolling = () => {
    // Poll every 5 seconds for new prescriptions
    statusPollIntervalRef.current = setInterval(async () => {
      try {
        const response = await eprescribeAPI.getPrescriptions(patientId);
        const prescriptions = response.data.prescriptions || [];
        
        // Check if any new prescriptions were sent
        const newSentPrescriptions = prescriptions.filter(
          p => (p.status === 'SENT' || p.status === 'sent') && 
               p.sent_at && 
               new Date(p.sent_at) > new Date(Date.now() - 10000) // Sent in last 10 seconds
        );

        if (newSentPrescriptions.length > 0 && onPrescriptionSent) {
          onPrescriptionSent(newSentPrescriptions);
          setStatus('completed');
          // Stop polling after completion
          if (statusPollIntervalRef.current) {
            clearInterval(statusPollIntervalRef.current);
            statusPollIntervalRef.current = null;
          }
        }
      } catch (err) {
        console.warn('Status polling error:', err);
        // Don't show error to user, just log it
      }
    }, 5000);
  };

  const handleIframeLoad = () => {
    // Iframe loaded successfully
    if (status === 'loading') {
      setStatus('ready');
    }
  };

  const handleIframeError = () => {
    setError('Failed to load prescribing interface');
    setStatus('error');
    setLoading(false);
  };

  const handleClose = () => {
    // Stop polling
    if (statusPollIntervalRef.current) {
      clearInterval(statusPollIntervalRef.current);
      statusPollIntervalRef.current = null;
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="full">
      <div className="flex flex-col h-full bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">
              New Prescription
            </h2>
            {patientName && (
              <span className="text-sm text-gray-600">
                for {patientName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {status === 'completed' && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-medium">Prescription Sent</span>
              </div>
            )}
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 relative overflow-hidden">
          {loading && status !== 'ready' && (
            <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
              <div className="text-center">
                <Loader className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-4" />
                <p className="text-gray-600">Loading prescribing interface...</p>
              </div>
            </div>
          )}

          {error && status === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
              <div className="text-center max-w-md">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <p className="text-gray-900 font-medium mb-2">Error Loading Interface</p>
                <p className="text-gray-600 mb-4">{error}</p>
                <button
                  onClick={loadSSOUrl}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
              </div>
            </div>
          )}

          {ssoUrl && (
            <iframe
              ref={iframeRef}
              src={ssoUrl}
              className="w-full h-full border-0"
              title="DoseSpot Prescribing Interface"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              allow="clipboard-read; clipboard-write"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            Powered by DoseSpot ePrescribing
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default DoseSpotPrescribe;

