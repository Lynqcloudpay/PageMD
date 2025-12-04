import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, VideoOff, Mic, MicOff, Phone, PhoneOff, 
  Monitor, MessageSquare, Users, Settings, Maximize2,
  Clock, User, Calendar, FileText, Camera
} from 'lucide-react';
import { format } from 'date-fns';

// Note: In production, this would integrate with a WebRTC service like Twilio, Zoom, or Doxy.me
const Telehealth = () => {
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [waitingRoom, setWaitingRoom] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Timer for call duration
  useEffect(() => {
    let interval;
    if (isInCall) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isInCall]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startCall = (patient) => {
    setSelectedPatient(patient);
    setIsInCall(true);
    setCallDuration(0);
    // In production: Initialize WebRTC connection
  };

  const endCall = () => {
    setIsInCall(false);
    setSelectedPatient(null);
    setCallDuration(0);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    // In production: Close WebRTC connection
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    setChatMessages([...chatMessages, {
      id: Date.now(),
      from: 'provider',
      text: newMessage,
      time: new Date()
    }]);
    setNewMessage('');
  };

  return (
    <div className="h-full flex bg-gray-900">
      {/* Sidebar - Waiting Room */}
      <div className="w-80 bg-white border-r border-paper-200 flex flex-col">
        <div className="p-4 border-b border-paper-200">
          <h2 className="text-lg font-bold text-ink-900 flex items-center">
            <Video className="w-5 h-5 mr-2 text-paper-600" />
            Telehealth
          </h2>
          <p className="text-sm text-ink-500 mt-1">
            {waitingRoom.length} patient(s) waiting
          </p>
        </div>

        {/* Waiting Room List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3">
            <h3 className="text-xs font-semibold text-ink-500 uppercase mb-2">Waiting Room</h3>
            {waitingRoom.length === 0 ? (
              <p className="text-sm text-ink-400 text-center py-4">No patients waiting</p>
            ) : (
              <div className="space-y-2">
                {waitingRoom.map(patient => (
                  <div 
                    key={patient.id}
                    className="p-3 bg-paper-50 rounded-lg border border-paper-200"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-ink-900">{patient.name}</p>
                        <p className="text-xs text-ink-500">{patient.reason}</p>
                        <div className="flex items-center space-x-2 mt-1 text-xs text-ink-400">
                          <Calendar className="w-3 h-3" />
                          <span>{patient.appointmentTime}</span>
                        </div>
                        <div className="flex items-center space-x-2 mt-1 text-xs text-orange-600">
                          <Clock className="w-3 h-3" />
                          <span>Waiting {Math.round((Date.now() - patient.waitingSince.getTime()) / 60000)} min</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => startCall(patient)}
                      disabled={isInCall}
                      className="mt-2 w-full px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 flex items-center justify-center"
                    >
                      <Video className="w-4 h-4 mr-1" />
                      Start Visit
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Appointments */}
          <div className="p-3 border-t border-paper-200">
            <h3 className="text-xs font-semibold text-ink-500 uppercase mb-2">Upcoming Today</h3>
            <div className="space-y-2">
              <p className="text-sm text-ink-400 text-center py-4">No upcoming appointments</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4 border-t border-paper-200">
          <button className="w-full px-4 py-2 border border-paper-300 rounded-md hover:bg-paper-50 text-sm flex items-center justify-center">
            <Settings className="w-4 h-4 mr-2" />
            Audio/Video Settings
          </button>
        </div>
      </div>

      {/* Main Video Area */}
      <div className="flex-1 flex flex-col">
        {isInCall ? (
          <>
            {/* Video Container */}
            <div className="flex-1 relative bg-gray-900">
              {/* Remote Video (Patient) */}
              <div className="absolute inset-4 bg-gray-800 rounded-lg flex items-center justify-center">
                {isVideoOff ? (
                  <div className="text-center">
                    <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <User className="w-12 h-12 text-gray-500" />
                    </div>
                    <p className="text-gray-400">{selectedPatient?.name}</p>
                    <p className="text-gray-500 text-sm">Camera is off</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#3B82F6' }}>
                      <User className="w-16 h-16 text-white" />
                    </div>
                    <p className="text-white text-lg">{selectedPatient?.name}</p>
                    <p className="text-gray-400 text-sm">Connected</p>
                  </div>
                )}
              </div>

              {/* Local Video (Self) */}
              <div className="absolute bottom-8 right-8 w-48 h-36 bg-gray-700 rounded-lg border-2 border-gray-600 overflow-hidden">
                <div className="w-full h-full flex items-center justify-center">
                  {isVideoOff ? (
                    <VideoOff className="w-8 h-8 text-gray-500" />
                  ) : (
                    <div className="bg-paper-600 w-full h-full flex items-center justify-center">
                      <Camera className="w-8 h-8 text-white" />
                    </div>
                  )}
                </div>
              </div>

              {/* Call Info Overlay */}
              <div className="absolute top-4 left-4 bg-black bg-opacity-50 rounded-lg px-4 py-2">
                <p className="text-white font-medium">{selectedPatient?.name}</p>
                <p className="text-gray-300 text-sm flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatDuration(callDuration)}
                </p>
              </div>

              {/* Recording Indicator */}
              <div className="absolute top-4 right-4 bg-red-600 rounded-full px-3 py-1 flex items-center">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse mr-2" />
                <span className="text-white text-xs font-medium">REC</span>
              </div>
            </div>

            {/* Controls */}
            <div className="bg-gray-800 p-4">
              <div className="flex items-center justify-center space-x-4">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`p-4 rounded-full ${isMuted ? 'bg-red-600' : 'bg-gray-600'} hover:bg-opacity-80 transition-colors`}
                >
                  {isMuted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
                </button>
                <button
                  onClick={() => setIsVideoOff(!isVideoOff)}
                  className={`p-4 rounded-full ${isVideoOff ? 'bg-red-600' : 'bg-gray-600'} hover:bg-opacity-80 transition-colors`}
                >
                  {isVideoOff ? <VideoOff className="w-6 h-6 text-white" /> : <Video className="w-6 h-6 text-white" />}
                </button>
                <button
                  onClick={() => setIsScreenSharing(!isScreenSharing)}
                  className={`p-4 rounded-full ${isScreenSharing ? '' : 'bg-gray-600'} hover:bg-opacity-80 transition-colors`}
                  style={isScreenSharing ? { background: '#3B82F6' } : {}}
                >
                  <Monitor className="w-6 h-6 text-white" />
                </button>
                <button
                  onClick={() => setShowChat(!showChat)}
                  className={`p-4 rounded-full ${showChat ? '' : 'bg-gray-600'} hover:bg-opacity-80 transition-colors`}
                  style={showChat ? { background: '#3B82F6' } : {}}
                >
                  <MessageSquare className="w-6 h-6 text-white" />
                </button>
                <button
                  onClick={endCall}
                  className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
                >
                  <PhoneOff className="w-6 h-6 text-white" />
                </button>
              </div>
              <p className="text-center text-gray-400 text-xs mt-2">
                Press Esc to minimize • Space to toggle mute
              </p>
            </div>
          </>
        ) : (
          /* No Active Call */
          <div className="flex-1 flex items-center justify-center bg-white">
            <div className="text-center">
              <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-primary-900 mb-2">Ready for Telehealth</h2>
              <p className="text-gray-600 mb-6">Select a patient from the waiting room to start a video visit</p>
              <div className="flex items-center justify-center space-x-4">
                <button className="px-4 py-2 text-white rounded-lg flex items-center transition-all duration-200 hover:shadow-md" style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'} onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}>
                  <Settings className="w-4 h-4 mr-2" />
                  Test Audio/Video
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Chat Panel */}
        {showChat && isInCall && (
          <div className="absolute right-0 top-0 bottom-20 w-80 bg-white shadow-xl flex flex-col">
            <div className="p-3 border-b border-paper-200 flex items-center justify-between">
              <h3 className="font-semibold text-ink-900">Chat</h3>
              <button onClick={() => setShowChat(false)} className="p-1 hover:bg-paper-100 rounded">
                <Maximize2 className="w-4 h-4 text-ink-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {chatMessages.map(msg => (
                <div 
                  key={msg.id}
                  className={`p-2 rounded-lg max-w-[80%] ${
                    msg.from === 'provider' 
                      ? 'bg-paper-100 ml-auto' 
                      : 'bg-blue-50'
                  }`}
                >
                  <p className="text-sm text-ink-800">{msg.text}</p>
                  <p className="text-xs text-ink-400 mt-1">
                    {format(msg.time, 'h:mm a')}
                  </p>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-paper-200">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border border-paper-300 rounded-lg text-sm"
                />
                <button
                  onClick={sendMessage}
                  className="px-3 py-2 text-white rounded-lg transition-all duration-200 hover:shadow-md"
                  style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Telehealth;






