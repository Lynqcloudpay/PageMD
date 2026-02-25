import React, { useState, useEffect } from 'react';
import {
  BarChart3, TrendingUp, Users, Calendar, DollarSign, Clock,
  Activity, FileText, Pill, AlertTriangle, CheckCircle, ArrowUp, ArrowDown,
  PieChart, Target, Stethoscope
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

// Mock analytics data - in production, this would come from the API
const generateMockData = () => ({
  // Key Performance Indicators
  kpis: {
    totalPatients: { value: 2847, change: 5.2, trend: 'up' },
    appointmentsToday: { value: 24, change: -2.1, trend: 'down' },
    avgWaitTime: { value: 12, unit: 'min', change: -15.3, trend: 'down' },
    revenue: { value: 45280, change: 8.7, trend: 'up' },
    noShowRate: { value: 4.2, unit: '%', change: -1.2, trend: 'down' },
    patientSatisfaction: { value: 4.7, unit: '/5', change: 0.2, trend: 'up' },
  },

  // Clinical Quality Measures
  qualityMeasures: [
    { name: 'Diabetes: A1c Control (<8%)', target: 80, actual: 76, patients: 342, compliant: 260 },
    { name: 'Hypertension: BP Control (<140/90)', target: 75, actual: 82, patients: 521, compliant: 427 },
    { name: 'Preventive: Flu Vaccination', target: 70, actual: 68, patients: 2847, compliant: 1936 },
    { name: 'Preventive: Colorectal Screening', target: 65, actual: 58, patients: 892, compliant: 517 },
    { name: 'Preventive: Breast Cancer Screening', target: 70, actual: 72, patients: 634, compliant: 456 },
    { name: 'Tobacco: Cessation Counseling', target: 85, actual: 91, patients: 423, compliant: 385 },
  ],

  // Appointment Statistics
  appointments: {
    completed: 892,
    scheduled: 156,
    cancelled: 45,
    noShow: 38,
    byType: [
      { type: 'Office Visit', count: 456 },
      { type: 'Follow-up', count: 298 },
      { type: 'Physical', count: 87 },
      { type: 'Telehealth', count: 143 },
      { type: 'Procedure', count: 53 },
    ],
  },

  // Provider Productivity
  providerStats: [
    { name: 'Dr. Rodriguez', patients: 847, appointments: 312, revenue: 156000, satisfaction: 4.8 },
    { name: 'Dr. Chen', patients: 723, appointments: 287, revenue: 142000, satisfaction: 4.6 },
    { name: 'Dr. Smith', patients: 698, appointments: 265, revenue: 128000, satisfaction: 4.7 },
    { name: 'NP Johnson', patients: 412, appointments: 198, revenue: 78000, satisfaction: 4.9 },
  ],

  // Financial Metrics
  financials: {
    collections: 245000,
    charges: 312000,
    adjustments: 42000,
    ar30: 28000,
    ar60: 12000,
    ar90: 8000,
    denialRate: 3.2,
    collectionRate: 78.5,
  },

  // Top Diagnoses
  topDiagnoses: [
    { code: 'E11.9', description: 'Type 2 Diabetes', count: 342 },
    { code: 'I10', description: 'Essential Hypertension', count: 521 },
    { code: 'J06.9', description: 'Acute URI', count: 187 },
    { code: 'M54.5', description: 'Low Back Pain', count: 156 },
    { code: 'F32.9', description: 'Major Depression', count: 134 },
    { code: 'E78.5', description: 'Hyperlipidemia', count: 298 },
    { code: 'J45.909', description: 'Asthma', count: 112 },
    { code: 'K21.0', description: 'GERD', count: 98 },
  ],

  // Pending Items
  pendingItems: {
    labResults: 45,
    prescriptionRefills: 23,
    priorAuths: 12,
    referrals: 18,
    unsignedNotes: 8,
  },
});

const Analytics = () => {
  const [data, setData] = useState(null);
  const [dateRange, setDateRange] = useState('month');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setData(generateMockData());
      setLoading(false);
    }, 500);
  }, [dateRange]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-ink-500">Loading analytics...</div>
      </div>
    );
  }

  const KPICard = ({ title, value, unit, change, trend, icon: Icon }) => (
    <div className="bg-white rounded-lg border border-paper-200 p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-ink-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-ink-900 mt-1">
            {typeof value === 'number' && title.includes('Revenue') ? `$${value.toLocaleString()}` : value}
            {unit && <span className="text-sm font-normal text-ink-500 ml-1">{unit}</span>}
          </p>
        </div>
        <div className={`p-2 rounded-lg ${trend === 'up' ? 'bg-green-100' : 'bg-red-100'}`}>
          <Icon className={`w-5 h-5 ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`} />
        </div>
      </div>
      <div className={`flex items-center mt-2 text-sm ${(trend === 'up' && change > 0) || (trend === 'down' && change < 0) ? 'text-green-600' : 'text-red-600'
        }`}>
        {change > 0 ? <ArrowUp className="w-4 h-4 mr-1" /> : <ArrowDown className="w-4 h-4 mr-1" />}
        <span>{Math.abs(change)}% from last {dateRange}</span>
      </div>
    </div>
  );

  const QualityMeasureBar = ({ measure }) => {
    const percentage = measure.actual;
    const isAtTarget = measure.actual >= measure.target;

    return (
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-ink-700">{measure.name}</span>
          <span className={`text-sm font-bold ${isAtTarget ? 'text-green-600' : 'text-yellow-600'}`}>
            {measure.actual}%
          </span>
        </div>
        <div className="relative h-3 bg-paper-200 rounded-full overflow-hidden">
          <div
            className={`absolute left-0 top-0 h-full rounded-full transition-all ${isAtTarget ? 'bg-green-500' : 'bg-yellow-500'
              }`}
            style={{ width: `${percentage}%` }}
          />
          <div
            className="absolute top-0 h-full w-0.5 bg-ink-400"
            style={{ left: `${measure.target}%` }}
            title={`Target: ${measure.target}%`}
          />
        </div>
        <div className="flex justify-between text-xs text-ink-500 mt-1">
          <span>{measure.compliant} of {measure.patients} patients</span>
          <span>Target: {measure.target}%</span>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-blue-600 shadow-sm border border-gray-100">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#111827] tracking-tighter uppercase mb-0.5">Practice Analytics</h1>
            <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">Performance metrics and insights</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-100 rounded-xl text-[11px] font-bold uppercase tracking-wider text-gray-600 focus:ring-4 focus:ring-blue-50 transition-all select-none outline-none appearance-none bg-white cursor-pointer"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          <button className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-200 hover:shadow-lg active:scale-95">
            Export Report
          </button>
        </div>
      </div>


      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          title="Total Patients"
          value={data.kpis.totalPatients.value}
          change={data.kpis.totalPatients.change}
          trend={data.kpis.totalPatients.trend}
          icon={Users}
        />
        <KPICard
          title="Appointments Today"
          value={data.kpis.appointmentsToday.value}
          change={data.kpis.appointmentsToday.change}
          trend={data.kpis.appointmentsToday.trend}
          icon={Calendar}
        />
        <KPICard
          title="Avg Wait Time"
          value={data.kpis.avgWaitTime.value}
          unit={data.kpis.avgWaitTime.unit}
          change={data.kpis.avgWaitTime.change}
          trend={data.kpis.avgWaitTime.trend}
          icon={Clock}
        />
        <KPICard
          title="Monthly Revenue"
          value={data.kpis.revenue.value}
          change={data.kpis.revenue.change}
          trend={data.kpis.revenue.trend}
          icon={DollarSign}
        />
        <KPICard
          title="No-Show Rate"
          value={data.kpis.noShowRate.value}
          unit={data.kpis.noShowRate.unit}
          change={data.kpis.noShowRate.change}
          trend={data.kpis.noShowRate.trend}
          icon={AlertTriangle}
        />
        <KPICard
          title="Patient Satisfaction"
          value={data.kpis.patientSatisfaction.value}
          unit={data.kpis.patientSatisfaction.unit}
          change={data.kpis.patientSatisfaction.change}
          trend={data.kpis.patientSatisfaction.trend}
          icon={CheckCircle}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quality Measures */}
        <div className="bg-white rounded-lg border border-paper-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-ink-900 flex items-center">
              <Target className="w-5 h-5 mr-2 text-paper-600" />
              Clinical Quality Measures
            </h2>
            <span className="text-xs text-ink-500">MIPS/Quality Reporting</span>
          </div>
          <div className="space-y-4">
            {data.qualityMeasures.map((measure, idx) => (
              <QualityMeasureBar key={idx} measure={measure} />
            ))}
          </div>
        </div>

        {/* Appointment Overview */}
        <div className="bg-white rounded-lg border border-paper-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-ink-900 flex items-center mb-4">
            <Calendar className="w-5 h-5 mr-2 text-paper-600" />
            Appointment Overview
          </h2>

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-700">{data.appointments.completed}</p>
              <p className="text-xs text-green-600">Completed</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-700">{data.appointments.scheduled}</p>
              <p className="text-xs text-blue-600">Scheduled</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-700">{data.appointments.cancelled}</p>
              <p className="text-xs text-yellow-600">Cancelled</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-700">{data.appointments.noShow}</p>
              <p className="text-xs text-red-600">No Show</p>
            </div>
          </div>

          {/* By Type */}
          <h3 className="text-sm font-semibold text-ink-700 mb-3">By Visit Type</h3>
          <div className="space-y-2">
            {data.appointments.byType.map((type, idx) => {
              const total = data.appointments.byType.reduce((sum, t) => sum + t.count, 0);
              const percentage = ((type.count / total) * 100).toFixed(1);
              return (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm text-ink-600">{type.type}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-24 h-2 bg-paper-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-paper-500 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-ink-700 w-12 text-right">{type.count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Provider Productivity */}
        <div className="bg-white rounded-lg border border-paper-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-ink-900 flex items-center mb-4">
            <Stethoscope className="w-5 h-5 mr-2 text-paper-600" />
            Provider Productivity
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-paper-200">
                  <th className="text-left py-2 text-ink-500 font-medium">Provider</th>
                  <th className="text-right py-2 text-ink-500 font-medium">Patients</th>
                  <th className="text-right py-2 text-ink-500 font-medium">Appts</th>
                  <th className="text-right py-2 text-ink-500 font-medium">Revenue</th>
                  <th className="text-right py-2 text-ink-500 font-medium">Rating</th>
                </tr>
              </thead>
              <tbody>
                {data.providerStats.map((provider, idx) => (
                  <tr key={idx} className="border-b border-paper-100">
                    <td className="py-3 font-medium text-ink-900">{provider.name}</td>
                    <td className="py-3 text-right text-ink-700">{provider.patients}</td>
                    <td className="py-3 text-right text-ink-700">{provider.appointments}</td>
                    <td className="py-3 text-right text-ink-700">${(provider.revenue / 1000).toFixed(0)}k</td>
                    <td className="py-3 text-right">
                      <span className="text-yellow-500">★</span> {provider.satisfaction}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Diagnoses */}
        <div className="bg-white rounded-lg border border-paper-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-ink-900 flex items-center mb-4">
            <Activity className="w-5 h-5 mr-2 text-paper-600" />
            Top Diagnoses
          </h2>
          <div className="space-y-3">
            {data.topDiagnoses.map((dx, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 hover:bg-paper-50 rounded">
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-mono bg-paper-100 text-paper-700 px-2 py-1 rounded">
                    {dx.code}
                  </span>
                  <span className="text-sm text-ink-700">{dx.description}</span>
                </div>
                <span className="text-sm font-semibold text-ink-900">{dx.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pending Items Alert */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-bold text-yellow-800 flex items-center mb-3">
          <AlertTriangle className="w-5 h-5 mr-2" />
          Pending Items Requiring Attention
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-700">{data.pendingItems.labResults}</p>
            <p className="text-xs text-yellow-600">Lab Results</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-700">{data.pendingItems.prescriptionRefills}</p>
            <p className="text-xs text-yellow-600">Rx Refills</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-700">{data.pendingItems.priorAuths}</p>
            <p className="text-xs text-yellow-600">Prior Auths</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-700">{data.pendingItems.referrals}</p>
            <p className="text-xs text-yellow-600">Referrals</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-700">{data.pendingItems.unsignedNotes}</p>
            <p className="text-xs text-yellow-600">Unsigned Notes</p>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-white rounded-lg border border-paper-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-ink-900 flex items-center mb-4">
          <DollarSign className="w-5 h-5 mr-2 text-paper-600" />
          Revenue Cycle Summary
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <div className="text-center p-3 bg-paper-50 rounded-lg">
            <p className="text-lg font-bold text-ink-900">${(data.financials.charges / 1000).toFixed(0)}k</p>
            <p className="text-xs text-ink-500">Charges</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <p className="text-lg font-bold text-green-700">${(data.financials.collections / 1000).toFixed(0)}k</p>
            <p className="text-xs text-green-600">Collections</p>
          </div>
          <div className="text-center p-3 bg-paper-50 rounded-lg">
            <p className="text-lg font-bold text-ink-900">${(data.financials.adjustments / 1000).toFixed(0)}k</p>
            <p className="text-xs text-ink-500">Adjustments</p>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <p className="text-lg font-bold text-yellow-700">${(data.financials.ar30 / 1000).toFixed(0)}k</p>
            <p className="text-xs text-yellow-600">A/R 30 days</p>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <p className="text-lg font-bold text-orange-700">${(data.financials.ar60 / 1000).toFixed(0)}k</p>
            <p className="text-xs text-orange-600">A/R 60 days</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <p className="text-lg font-bold text-red-700">${(data.financials.ar90 / 1000).toFixed(0)}k</p>
            <p className="text-xs text-red-600">A/R 90+ days</p>
          </div>
          <div className="text-center p-3 bg-paper-50 rounded-lg">
            <p className="text-lg font-bold text-ink-900">{data.financials.denialRate}%</p>
            <p className="text-xs text-ink-500">Denial Rate</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-lg font-bold text-blue-700">{data.financials.collectionRate}%</p>
            <p className="text-xs text-blue-600">Collection Rate</p>
          </div>
        </div>
      </div>
    </div >
  );
};

export default Analytics;










