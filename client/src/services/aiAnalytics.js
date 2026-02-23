import { BREAKPOINTS } from '../hooks/useBreakpoint';

const clamp = (value, min, max) => {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const computeBasicStats = values => {
  if (!values || !values.length) {
    return { mean: 0, std: 0 };
  }
  const valid = values.filter(v => typeof v === 'number' && !Number.isNaN(v));
  if (!valid.length) {
    return { mean: 0, std: 0 };
  }
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  const variance =
    valid.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) /
    valid.length;
  const std = Math.sqrt(variance);
  return { mean, std };
};

const computeAnomalies = (items, valueKey) => {
  if (!items || !items.length) return [];
  const values = items.map(i => Number(i[valueKey] || 0));
  const { mean, std } = computeBasicStats(values);
  if (std === 0) return [];
  const thresholdHigh = mean + std * 2;
  const anomalies = [];
  items.forEach((item, index) => {
    const value = values[index];
    if (value > thresholdHigh) {
      const z = (value - mean) / std;
      anomalies.push({
        name: item.name || item.label || String(index),
        value,
        zScore: z,
        mean,
        std
      });
    }
  });
  return anomalies;
};

const buildSummaryText = context => {
  const total =
    context.totalOngoing + context.totalCompleted + context.totalIncomplete;
  if (!total) {
    return 'No cadet analytics data is available yet. The AI engine will activate once data is present.';
  }
  const ongoingPct = ((context.totalOngoing / total) * 100).toFixed(1);
  const completedPct = ((context.totalCompleted / total) * 100).toFixed(1);
  const incompletePct = ((context.totalIncomplete / total) * 100).toFixed(1);
  const basicShare = context.ongoingBasicTotal
    ? ((context.ongoingBasicTotal / context.totalOngoing) * 100).toFixed(1)
    : '0.0';
  const advanceShare = context.ongoingAdvanceTotal
    ? ((context.ongoingAdvanceTotal / context.totalOngoing) * 100).toFixed(1)
    : '0.0';
  return `The AI overview estimates that ${ongoingPct}% of tracked cadets are currently ongoing, ${completedPct}% have completed their ROTC requirements, and ${incompletePct}% are incomplete or at risk. Among ongoing cadets, approximately ${basicShare}% are in the Basic Corps and ${advanceShare}% are in the Advance Corps.`;
};

export const analyzeAnalyticsData = params => {
  const stats = params.stats || {};
  const genderByCourse = params.genderByCourse || [];
  const courseTotals = params.courseTotals || [];
  const religionData = params.religionData || [];
  const ageData = params.ageData || [];
  const totalOngoing = stats.ongoing?.total || 0;
  const totalCompleted = stats.completed?.total || 0;
  const totalIncomplete = stats.incomplete?.total || 0;
  const ongoingBasicTotal = stats.ongoing?.basic?.total || 0;
  const ongoingAdvanceTotal = stats.ongoing?.advance?.total || 0;
  const totalCadets = totalOngoing + totalCompleted + totalIncomplete;
  const insights = [];
  const alerts = [];
  const recommendations = [];
  const anomaliesByCourse = computeAnomalies(courseTotals, 'value');
  const criticalIncompleteRatio =
    totalCadets > 0 ? totalIncomplete / totalCadets : 0;
  const highIncomplete = criticalIncompleteRatio >= 0.2;
  if (totalCadets > 0) {
    let severity = 'low';
    if (criticalIncompleteRatio >= 0.1 && criticalIncompleteRatio < 0.2) {
      severity = 'medium';
    } else if (criticalIncompleteRatio >= 0.2) {
      severity = 'high';
    }
    const confidence = clamp(
      0.45 + criticalIncompleteRatio * 0.8,
      0.5,
      0.97
    );
    const detail = `Approximately ${(
      criticalIncompleteRatio * 100
    ).toFixed(1)}% of cadets are marked as incomplete or at risk.`;
    const explanation =
      'This insight is based on the ratio between incomplete cadets and the total cadet population in the analytics dataset.';
    const item = {
      id: 'risk-incomplete-ratio',
      title: 'Elevated incomplete cadet ratio',
      detail,
      severity,
      confidence,
      metrics: {
        totalCadets,
        totalIncomplete,
        ratio: criticalIncompleteRatio
      },
      explanation
    };
    insights.push(item);
    if (severity !== 'low') {
      alerts.push(item);
      recommendations.push({
        id: 'reco-focus-incomplete',
        label: 'Review incomplete cadets and grading records',
        targetRoute: '/admin/grading',
        reason:
          'The proportion of incomplete cadets is above the 10% risk threshold in the current dataset.'
      });
    }
  }
  if (anomaliesByCourse.length) {
    anomaliesByCourse.forEach(a => {
      const confidence = clamp(0.6 + Math.min(a.zScore / 6, 0.3), 0.6, 0.95);
      const explanation =
        'The anomaly score is derived from a z-score comparison against the mean course population for this dataset.';
      const item = {
        id: `anomaly-course-${a.name}`,
        title: `Unusual enrollment pattern for ${a.name}`,
        detail: `${a.name} shows a significantly higher cadet count than the average course in this dataset.`,
        severity: 'medium',
        confidence,
        metrics: {
          value: a.value,
          mean: a.mean,
          std: a.std,
          zScore: a.zScore
        },
        explanation
      };
      insights.push(item);
      recommendations.push({
        id: `reco-course-${a.name}`,
        label: `Inspect enrollment and performance for ${a.name}`,
        targetRoute: '/admin/data-analysis',
        reason: `${a.name} exhibits a count more than two standard deviations above the mean across courses.`
      });
    });
  }
  genderByCourse.forEach(row => {
    const total =
      Number(row.Male || 0) +
      Number(row.Female || 0) +
      Number(row.Unknown || 0);
    if (!total) return;
    const maleShare = Number(row.Male || 0) / total;
    const femaleShare = Number(row.Female || 0) / total;
    const dominant =
      maleShare >= 0.7
        ? { label: 'Male', share: maleShare }
        : femaleShare >= 0.7
        ? { label: 'Female', share: femaleShare }
        : null;
    if (dominant) {
      const confidence = clamp(0.6 + dominant.share / 3, 0.6, 0.95);
      const explanation =
        'The distribution is evaluated by comparing gender counts per course and flagging any group above 70% share.';
      insights.push({
        id: `gender-imbalance-${row.name}`,
        title: `Gender imbalance detected in ${row.name}`,
        detail: `${dominant.label} cadets make up approximately ${(
          dominant.share * 100
        ).toFixed(1)}% of ${row.name}.`,
        severity: 'medium',
        confidence,
        metrics: {
          total,
          male: Number(row.Male || 0),
          female: Number(row.Female || 0),
          unknown: Number(row.Unknown || 0)
        },
        explanation
      });
    }
  });
  if (religionData && religionData.length) {
    const anomaliesByReligion = computeAnomalies(religionData, 'value');
    anomaliesByReligion.forEach(a => {
      const confidence = clamp(0.55 + Math.min(a.zScore / 8, 0.25), 0.55, 0.9);
      const explanation =
        'Anomaly detection is based on comparing each religion count to the mean distribution and flagging high z-scores.';
      insights.push({
        id: `religion-anomaly-${a.name}`,
        title: `Distinct religion distribution for ${a.name}`,
        detail: `${a.name} has a higher cadet representation than expected when compared to other religions in the dataset.`,
        severity: 'low',
        confidence,
        metrics: {
          value: a.value,
          mean: a.mean,
          std: a.std,
          zScore: a.zScore
        },
        explanation
      });
    });
  }
  if (ageData && ageData.length) {
    const anomaliesByAge = computeAnomalies(ageData, 'value');
    anomaliesByAge.forEach(a => {
      const confidence = clamp(0.55 + Math.min(a.zScore / 8, 0.25), 0.55, 0.9);
      const explanation =
        'Age anomalies are calculated by comparing each age band count to the distribution mean and standard deviation.';
      insights.push({
        id: `age-anomaly-${a.name}`,
        title: `Dominant age band ${a.name}`,
        detail: `${a.name} has a notably higher number of cadets than the average age range in this dataset.`,
        severity: 'low',
        confidence,
        metrics: {
          value: a.value,
          mean: a.mean,
          std: a.std,
          zScore: a.zScore
        },
        explanation
      });
    });
  }
  const summaryContext = {
    totalOngoing,
    totalCompleted,
    totalIncomplete,
    ongoingBasicTotal,
    ongoingAdvanceTotal
  };
  const summaryText = buildSummaryText(summaryContext);
  const breakpointAwareHints = [];
  const widthHints = Object.values(BREAKPOINTS).map(b => ({
    name: b.name,
    min: b.min,
    max: b.max
  }));
  breakpointAwareHints.push({
    label: 'Layout breakpoints',
    details: widthHints
  });
  const dataPoints =
    (courseTotals ? courseTotals.length : 0) +
    (genderByCourse ? genderByCourse.length : 0) +
    (religionData ? religionData.length : 0) +
    (ageData ? ageData.length : 0);
  return {
    summary: {
      text: summaryText,
      totalCadets,
      statusBreakdown: {
        ongoing: totalOngoing,
        completed: totalCompleted,
        incomplete: totalIncomplete,
        basic: ongoingBasicTotal,
        advance: ongoingAdvanceTotal
      }
    },
    insights,
    alerts,
    recommendations,
    explainability: {
      methods: ['distribution analysis', 'z-score anomaly detection'],
      breakpointHints: breakpointAwareHints
    },
    meta: {
      dataPoints
    }
  };
};

export const queryAnalyticsInsights = (query, analysisResult) => {
  if (!query || !analysisResult) {
    return {
      answer:
        'Provide a question about cadet status, courses, genders, religions, or age ranges to receive an AI summary.',
      matchedInsights: []
    };
  }
  const text = query.toLowerCase();
  const tokens = text.split(/\s+/).filter(Boolean);
  const insights = analysisResult.insights || [];
  const matched = insights.filter(i => {
    const haystack = `${i.title} ${i.detail}`.toLowerCase();
    return tokens.every(t => haystack.includes(t));
  });
  if (matched.length) {
    const top = matched[0];
    const answer =
      top.detail +
      ' Confidence score: ' +
      Math.round((top.confidence || 0.5) * 100) +
      '%.';
    return {
      answer,
      matchedInsights: matched
    };
  }
  const summary = analysisResult.summary;
  if (text.includes('incomplete')) {
    const total =
      summary?.statusBreakdown?.incomplete || analysisResult.summary?.statusBreakdown?.incomplete || 0;
    const overall =
      summary?.statusBreakdown?.ongoing +
        summary?.statusBreakdown?.completed +
        summary?.statusBreakdown?.incomplete || 0;
    const ratio = overall ? (total / overall) * 100 : 0;
    const answer = `There are ${total} incomplete cadets in the analytics dataset, representing approximately ${ratio.toFixed(
      1
    )}% of the total tracked population.`;
    return {
      answer,
      matchedInsights: []
    };
  }
  if (text.includes('basic') || text.includes('advance')) {
    const ongoing = analysisResult.summary?.statusBreakdown?.ongoing || 0;
    const basic = analysisResult.summary?.statusBreakdown?.basic ?? null;
    const answer =
      ongoing > 0 && basic != null
        ? `The AI engine estimates that Basic Corps cadets represent about ${(
            (basic / ongoing) *
            100
          ).toFixed(1)}% of all ongoing cadets.`
        : analysisResult.summary?.text ||
          'The data for the Basic and Advance corps has not been fully loaded yet.';
    return {
      answer,
      matchedInsights: []
    };
  }
  return {
    answer:
      analysisResult.summary?.text ||
      'The AI engine could not find a direct match for this question but the overall status is stable based on the current dataset.',
    matchedInsights: []
  };
};

export const analyzeStaffAnalytics = params => {
  const stats = params?.stats || {};
  const totalStaff = Number(stats.totalStaff || 0);
  const attendanceStats = Array.isArray(stats.attendanceStats)
    ? stats.attendanceStats
    : [];
  const staffByRank = Array.isArray(stats.staffByRank)
    ? stats.staffByRank
    : [];
  const insights = [];
  const alerts = [];
  const recommendations = [];
  const totalAttendanceRecords = attendanceStats.reduce(
    (sum, item) => sum + Number(item.count || 0),
    0
  );
  const presentItem = attendanceStats.find(
    s => String(s.status).toLowerCase() === 'present'
  );
  const absentItem = attendanceStats.find(
    s => String(s.status).toLowerCase() === 'absent'
  );
  const lateItem = attendanceStats.find(
    s => String(s.status).toLowerCase() === 'late'
  );
  const present = Number(presentItem?.count || 0);
  const absent = Number(absentItem?.count || 0);
  const late = Number(lateItem?.count || 0);
  const effectiveTotal =
    totalAttendanceRecords || present + absent + late || totalStaff || 0;
  const reliabilityBase = effectiveTotal || totalStaff || 1;
  const attendanceRate = reliabilityBase ? present / reliabilityBase : 0;
  const riskLoad = reliabilityBase ? (absent + late) / reliabilityBase : 0;
  if (reliabilityBase > 0) {
    const confidence = clamp(0.45 + attendanceRate * 0.7, 0.5, 0.97);
    let severity = 'low';
    if (riskLoad >= 0.1 && riskLoad < 0.2) severity = 'medium';
    if (riskLoad >= 0.2) severity = 'high';
    const detail = `Out of approximately ${reliabilityBase} recorded staff attendance events, around ${(
      attendanceRate * 100
    ).toFixed(1)}% are present, while combined absent and late records account for about ${(
      riskLoad * 100
    ).toFixed(1)}%.`;
    const explanation =
      'This overview evaluates staff attendance by comparing present records to the combined absent and late counts.';
    const item = {
      id: 'staff-attendance-overview',
      title: 'Staff attendance stability overview',
      detail,
      severity,
      confidence,
      metrics: {
        present,
        absent,
        late,
        totalAttendanceRecords: reliabilityBase
      },
      explanation
    };
    insights.push(item);
    if (severity !== 'low') {
      alerts.push(item);
      recommendations.push({
        id: 'reco-staff-attendance',
        label: 'Review staff attendance patterns',
        targetRoute: '/admin/staff-analytics',
        reason:
          'Combined absent and late records are elevated compared with present records in the current staff analytics dataset.'
      });
    }
  }
  if (staffByRank.length) {
    const anomalies = computeAnomalies(
      staffByRank.map(r => ({ name: r.rank, value: Number(r.count || 0) })),
      'value'
    );
    anomalies.forEach(a => {
      const confidence = clamp(
        0.55 + Math.min(a.zScore / 8, 0.3),
        0.55,
        0.9
      );
      const explanation =
        'Rank anomalies are computed from the distribution of staff counts per rank and highlight any category with an unusually high count.';
      insights.push({
        id: `staff-rank-anomaly-${a.name}`,
        title: `Unusual staff concentration at rank ${a.name}`,
        detail: `${a.name} shows a noticeably higher number of staff than the average rank in this dataset.`,
        severity: 'medium',
        confidence,
        metrics: {
          value: a.value,
          mean: a.mean,
          std: a.std,
          zScore: a.zScore
        },
        explanation
      });
    });
  }
  const attendanceText =
    effectiveTotal > 0
      ? `Based on current records, staff attendance is approximately ${(attendanceRate * 100).toFixed(
          1
        )}% with ${present} present, ${absent} absent, and ${late} late entries accounted for in the analytics overview.`
      : 'Staff attendance analytics have not yet recorded enough events for a stable AI summary.';
  const summaryText =
    totalStaff > 0
      ? `The AI engine estimates that there are about ${totalStaff} training staff in the unit. ${attendanceText}`
      : attendanceText;
  const meta = {
    totalStaff,
    totalAttendanceRecords: effectiveTotal,
    rankBuckets: staffByRank.length
  };
  return {
    summary: {
      text: summaryText,
      totalStaff,
      attendance: {
        present,
        absent,
        late
      }
    },
    insights,
    alerts,
    recommendations,
    meta
  };
};

export const analyzeCadetDashboard = params => {
  const grades = params?.grades || {};
  const attendance = params?.attendance || {};
  const items = Array.isArray(attendance.items) ? attendance.items : [];
  const totalDays = items.length;
  const presentDays = items.filter(item => {
    const status = String(item.status || '').toLowerCase();
    return status === 'present';
  }).length;
  const attendanceRate = totalDays ? presentDays / totalDays : 0;
  const hasGrades = !!grades && Object.keys(grades).length > 0;
  let gradeDetail = 'Final grade data is not yet available.';
  const numericFinal =
    typeof grades.finalGrade === 'number'
      ? grades.finalGrade
      : typeof grades.final_grade === 'number'
      ? grades.final_grade
      : null;
  if (numericFinal != null) {
    const passed = numericFinal >= 75;
    gradeDetail = `Your current final percentage is approximately ${numericFinal.toFixed(
      1
    )}%, which is interpreted as ${
      passed ? 'passing' : 'failing'
    } under the current grading rules.`;
  }
  const attendanceDetail =
    totalDays > 0
      ? `You have recorded attendance for ${totalDays} training days, with about ${(
          attendanceRate * 100
        ).toFixed(1)}% marked as present.`
      : 'Your attendance calendar has not yet recorded enough training days for a detailed summary.';
  const text = hasGrades
    ? `${gradeDetail} ${attendanceDetail}`
    : `${attendanceDetail}`;
  return {
    text,
    stats: {
      totalDays,
      presentDays,
      attendanceRate,
      hasGrades
    }
  };
};
