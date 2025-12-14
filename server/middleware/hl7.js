// HL7 Message Parser - OpenEMR inspired
// Handles HL7 v2.x messages for lab results, orders, etc.

class HL7Parser {
  constructor(message) {
    this.message = message;
    this.segments = message.split('\r').filter(s => s.trim());
  }

  parse() {
    const parsed = {
      messageType: null,
      messageControlId: null,
      patient: {},
      orders: [],
      results: []
    };

    for (const segment of this.segments) {
      const segmentType = segment.substring(0, 3);
      
      switch (segmentType) {
        case 'MSH':
          parsed.messageType = this.parseMSH(segment);
          break;
        case 'PID':
          parsed.patient = this.parsePID(segment);
          break;
        case 'OBR':
          parsed.orders.push(this.parseOBR(segment));
          break;
        case 'OBX':
          parsed.results.push(this.parseOBX(segment));
          break;
      }
    }

    return parsed;
  }

  parseMSH(segment) {
    const fields = segment.split('|');
    return {
      sendingApplication: fields[3],
      sendingFacility: fields[4],
      receivingApplication: fields[5],
      receivingFacility: fields[6],
      messageType: fields[8],
      messageControlId: fields[9],
      processingId: fields[11]
    };
  }

  parsePID(segment) {
    const fields = segment.split('|');
    const name = fields[5] ? fields[5].split('^') : [];
    return {
      patientId: fields[3],
      lastName: name[0] || '',
      firstName: name[1] || '',
      middleName: name[2] || '',
      dob: fields[7],
      sex: fields[8],
      address: fields[11] ? fields[11].split('^') : []
    };
  }

  parseOBR(segment) {
    const fields = segment.split('|');
    return {
      orderId: fields[2],
      universalServiceId: fields[4],
      observationDateTime: fields[7],
      orderingProvider: fields[16] ? fields[16].split('^') : []
    };
  }

  parseOBX(segment) {
    const fields = segment.split('|');
    const value = fields[5];
    const units = fields[6];
    const referenceRange = fields[7];
    
    return {
      setId: fields[1],
      valueType: fields[2],
      observationId: fields[3],
      observationValue: value,
      units: units,
      referenceRange: referenceRange,
      abnormalFlags: fields[8],
      observationDateTime: fields[14]
    };
  }
}

// Generate HL7 message
class HL7Generator {
  static generateORU(labResult) {
    const msh = `MSH|^~\\&|LAB|FACILITY|EMR|CLINIC|${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}||ORU^R01|MSG001|P|2.5\r`;
    const pid = `PID|1||${labResult.patientId}||${labResult.lastName}^${labResult.firstName}||${labResult.dob}|${labResult.sex}\r`;
    const obr = `OBR|1|${labResult.orderId}||${labResult.testCode}|||||||${labResult.collectedDate}\r`;
    const obx = `OBX|1|${labResult.valueType}|${labResult.testCode}|${labResult.testName}||${labResult.value}|${labResult.units}|${labResult.referenceRange}|||F\r`;
    
    return msh + pid + obr + obx;
  }
}

module.exports = { HL7Parser, HL7Generator };

















