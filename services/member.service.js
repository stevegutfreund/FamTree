const path = require("path");
const FILE = path.basename(__filename).split(".js")[0].toUpperCase();

var fs = require("fs").promises;
const validator = require("validator");

const {
  ExError,
  STATUS_CODE,
  INTERNAL_ERRORS,
} = require("../middleware/errorHandler");
const uuid = require("uuid");
const searchService = require("./search.service");

let MEMBERS = {};

let R_UUID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function format(member) {
  if (member.father) member.father = `${API_DOMAIN}/members/${member.father}`;
  if (member.mother) member.mother = `${API_DOMAIN}/members/${member.mother}`;
  if (member.spouses)
    member.spouses = member.spouses.map(
      (spouse) => `${API_DOMAIN}/members/${spouse}`
    );

  // Calculate age at time of death if both birth and death years are available
  if (member.born !== undefined && member.passed !== undefined) {
    member.ageAtDeath = member.passed - member.born;
  }

  return member;
}

function formatSearchResult(member) {
  const formatted = { ...member };

  // Add URL for API access
  formatted.url = `${API_DOMAIN}/members/${member.uuid}`;

  // Add parent names for disambiguation (keeping original UUIDs for API calls)
  if (member.father && MEMBERS[member.father]) {
    formatted.fatherName = MEMBERS[member.father].name;
  }
  if (member.mother && MEMBERS[member.mother]) {
    formatted.motherName = MEMBERS[member.mother].name;
  }

  // Create display name with distinguishing information
  let displayName = member.name;
  const details = [];

  if (member.born) {
    details.push(`b. ${member.born}`);
  }

  if (member.passed) {
    details.push(`d. ${member.passed}`);
  }

  // Add parent information for disambiguation
  const parentNames = [];
  if (formatted.fatherName) {
    parentNames.push(`father: ${formatted.fatherName}`);
  }
  if (formatted.motherName) {
    parentNames.push(`mother: ${formatted.motherName}`);
  }

  if (parentNames.length > 0) {
    details.push(parentNames.join(", "));
  }

  if (details.length > 0) {
    displayName += ` (${details.join(", ")})`;
  }

  formatted.displayName = displayName;

  // Calculate age at time of death if both birth and death years are available
  if (member.born !== undefined && member.passed !== undefined) {
    formatted.ageAtDeath = member.passed - member.born;
  }

  return formatted;
}

function sanitizeInput(input) {
  if (typeof input !== "string") return input;

  // Escape HTML and trim whitespace
  return validator.escape(input.trim());
}

function add(params) {
  logger.info(`[${FILE}] add called`);

  // Sanitize string inputs
  if (params.name) {
    params.name = sanitizeInput(params.name);
  }

  // Validation
  if (
    !params.name ||
    typeof params.name !== "string" ||
    params.name.trim() === ""
  ) {
    logger.error(`[${FILE}] invalid name parameter`);
    throw new ExError(
      STATUS_CODE.CLIENT_ERROR,
      "Name is required and must be a non-empty string"
    );
  }

  // Validate name length and characters
  if (params.name.length > 100) {
    logger.error(`[${FILE}] name too long: ${params.name.length} characters`);
    throw new ExError(
      STATUS_CODE.CLIENT_ERROR,
      "Name must be less than 100 characters"
    );
  }

  // Validate birth/death years if provided
  if (
    params.born !== undefined &&
    (typeof params.born !== "number" || params.born < 0 || params.born > 10000)
  ) {
    logger.error(`[${FILE}] invalid born year: ${params.born}`);
    throw new ExError(
      STATUS_CODE.CLIENT_ERROR,
      "Born year must be a number between 0 and 10000"
    );
  }

  if (
    params.passed !== undefined &&
    (typeof params.passed !== "number" ||
      params.passed < 0 ||
      params.passed > 10000)
  ) {
    logger.error(`[${FILE}] invalid passed year: ${params.passed}`);
    throw new ExError(
      STATUS_CODE.CLIENT_ERROR,
      "Passed year must be a number between 0 and 10000"
    );
  }

  if (
    params.born !== undefined &&
    params.passed !== undefined &&
    params.passed <= params.born
  ) {
    logger.warn(
      `[${FILE}] warning: ${params.name} death year (${params.passed}) is before or same as birth year (${params.born})`
    );
    // Temporarily allowing this for data loading - should be fixed in data
    // throw new ExError(
    //   STATUS_CODE.CLIENT_ERROR,
    //   "Death year must be after birth year"
    // );
  }

  if (!params.uuid) params.uuid = uuid.v4();

  if (params.father && !R_UUID.test(params.father)) {
    let father = search(params.father, false);
    if (father.length === 0) {
      logger.warn(`[${FILE}] creating father`);
      params.father = add({ name: params.father });
    } else if (father.length > 1) {
      logger.error(`[${FILE}] more than one with same name`);
      throw new ExError(STATUS_CODE.CLIENT_ERROR);
    } else {
      params.father = father[0].uuid;
    }
  }

  if (params.mother && !R_UUID.test(params.mother)) {
    let mother = search(params.mother, false);
    if (mother.length === 0) {
      logger.warn(`[${FILE}] creating mother`);
      params.mother = add({ name: params.mother });
    } else if (mother.length > 1) {
      logger.err(`[${FILE}] more than one with same name`);
      throw new ExError(STATUS_CODE.CLIENT_ERROR);
    } else {
      params.mother = mother[0].uuid;
    }
  }

  if (params.spouses && params.spouses.length) {
    params.spouses = params.spouses.map((spouse) => {
      if (R_UUID.test(spouse)) {
        // link the other direction too, so the marriage shows from both sides
        const other = MEMBERS[spouse];
        if (other) {
          other.spouses = other.spouses || [];
          if (!other.spouses.includes(params.uuid)) other.spouses.push(params.uuid);
        }
        return spouse;
      }
      let _spouse = search(spouse, false);
      if (_spouse.length === 0) {
        logger.warn(`[${FILE}] creating spouse`);
        return add({ name: spouse, spouses: [params.uuid] });
      } else if (_spouse.length > 1) {
        logger.err(`[${FILE}] more than one with same name`);
        throw new ExError(STATUS_CODE.CLIENT_ERROR);
      } else {
        MEMBERS[_spouse[0].uuid].spouses.push(params.uuid);
        return _spouse[0].uuid;
      }
    });
  } else params.spouses = [];

  MEMBERS[params.uuid] = params;

  return params.uuid;
}

function edit(uuid, params) {
  logger.info(`[${FILE}] edit called`);

  if (!uuid in MEMBERS) {
    logger.error(`[${FILE}] uuid (${uuid}) not found`);
    throw new ExError(STATUS_CODE.CLIENT_ERROR);
  }

  if (params.name) MEMBERS[uuid].name = params.name;

  if (params.father) {
    if (R_UUID.test(params.father)) {
      logger.info(`[${FILE}] received father uuid (${params.father})`);
      if (params.father in MEMBERS) MEMBERS[uuid].father = params.father;
      else {
        logger.error(`[${FILE}] father uuid (${params.father}) not found`);
        throw new ExError(STATUS_CODE.CLIENT_ERROR);
      }
    } else {
      logger.info(`[${FILE}] received father name (${params.father})`);
      let father = search(params.father, false);
      if (father.length === 0) {
        logger.warn(`[${FILE}] creating father`);
        MEMBERS[uuid].father = add({ name: params.father });
      } else if (father.length > 1) {
        logger.err(`[${FILE}] more than one with same name`);
        throw new ExError(STATUS_CODE.CLIENT_ERROR);
      } else {
        MEMBERS[uuid].father = father[0].uuid;
      }
    }
  }

  if (params.mother) {
    if (R_UUID.test(params.mother)) {
      logger.info(`[${FILE}] received mother uuid (${params.mother})`);
      if (params.mother in MEMBERS) MEMBERS[uuid].mother = params.mother;
      else {
        logger.error(`[${FILE}] mother uuid (${params.mother}) not found`);
        throw new ExError(STATUS_CODE.CLIENT_ERROR);
      }
    } else {
      logger.info(`[${FILE}] received mother name (${params.mother})`);
      let mother = search(params.mother, false);
      if (mother.length === 0) {
        logger.warn(`[${FILE}] creating mother`);
        MEMBERS[uuid].mother = add({ name: params.mother });
      } else if (mother.length > 1) {
        logger.err(`[${FILE}] more than one with same name`);
        throw new ExError(STATUS_CODE.CLIENT_ERROR);
      } else {
        MEMBERS[uuid].mother = mother[0].uuid;
      }
    }
  }

  if (params.spouses && params.spouses.length) {
    params.spouses = params.spouses.map((spouse) => {
      if (R_UUID.test(spouse)) {
        logger.info(`[${FILE}] received spouse uuid (${spouse})`);
        if (spouse in MEMBERS) return spouse;
        else {
          logger.error(`[${FILE}] spouse uuid (${spouse}) not found`);
          throw new ExError(STATUS_CODE.CLIENT_ERROR);
        }
      } else {
        logger.info(`[${FILE}] received spouse name (${spouse})`);
        let _spouse = search(spouse, false);
        if (_spouse.length === 0) {
          logger.warn(`[${FILE}] creating spouse`);
          return add({ name: spouse });
        } else if (_spouse.length > 1) {
          logger.err(`[${FILE}] more than one with same name`);
          throw new ExError(STATUS_CODE.CLIENT_ERROR);
        } else {
          return _spouse[0].uuid;
        }
      }
    });
  }
}

function editName(uuid, name) {
  logger.info(`[${FILE}] editName called`);

  if (!uuid in MEMBERS) {
    logger.error(`[${FILE}] uuid (${uuid}) not found`);
    throw new ExError(STATUS_CODE.CLIENT_ERROR);
  }

  MEMBERS[uuid].name = name;
}

function removeSpouse(uuid, name) {
  logger.info(`[${FILE}] removeSpouse called`);

  if (!uuid in MEMBERS) {
    logger.error(`[${FILE}] uuid (${uuid}) not found`);
    throw new ExError(STATUS_CODE.CLIENT_ERROR);
  }

  let otherUuid;

  if (R_UUID.test(name)) {
    otherUuid = name;
    logger.info(`[${FILE}] received spouse uuid (${otherUuid})`);
    if (!otherUuid in MEMBERS) {
      logger.error(`[${FILE}] spouse uuid (${name}) not found`);
      throw new ExError(STATUS_CODE.CLIENT_ERROR);
    }
  } else {
    logger.info(`[${FILE}] received spouse name (${name})`);
    let spouses = search(name, false);

    if (spouses.length === 0) {
      logger.error(`[${FILE}] spouse (${name}) not found`);
      throw new ExError(STATUS_CODE.CLIENT_ERROR);
    } else if (spouses.length > 1) {
      logger.err(`[${FILE}] more than one with same name`);
      throw new ExError(STATUS_CODE.CLIENT_ERROR);
    }
    otherUuid = spouses[0].uuid;
    logger.info(`[${FILE}] spouse uuid (${otherUuid})`);
  }

  MEMBERS[uuid].spouses = MEMBERS[uuid].spouses.filter(
    (spouse) => spouse !== otherUuid
  );
  MEMBERS[otherUuid].spouses = MEMBERS[otherUuid].spouses.filter(
    (spouse) => spouse !== uuid
  );
}

function addSpouse(uuid, name) {
  logger.info(`[${FILE}] addSpouse called`);

  if (!uuid in MEMBERS) {
    logger.error(`[${FILE}] uuid (${uuid}) not found`);
    throw new ExError(STATUS_CODE.CLIENT_ERROR);
  }

  if (R_UUID.test(name)) {
    otherUuid = name;
    logger.info(`[${FILE}] received spouse uuid (${otherUuid})`);
    if (!otherUuid in MEMBERS) {
      logger.error(`[${FILE}] spouse uuid (${name}) not found`);
      throw new ExError(STATUS_CODE.CLIENT_ERROR);
    }
  } else {
    logger.info(`[${FILE}] received spouse name (${name})`);
    let spouses = search(name, false);

    if (spouses.length === 0) {
      logger.warn(`[${FILE}] creating spouse`);
      otherUuid = add({ name });
    } else if (spouses.length > 1) {
      logger.err(`[${FILE}] more than one with same name`);
      throw new ExError(STATUS_CODE.CLIENT_ERROR);
    } else {
      otherUuid = spouses[0].uuid;
    }
    logger.info(`[${FILE}] spouse uuid (${otherUuid})`);
  }

  // Only add each direction if it isn't already there — otherwise a
  // pre-existing one-directional relationship (A lists B but not vice versa)
  // gets B a duplicate of A when the reverse link is added through the UI.
  if (!MEMBERS[uuid].spouses.includes(otherUuid)) {
    MEMBERS[uuid].spouses.push(otherUuid);
  }
  if (!MEMBERS[otherUuid].spouses.includes(uuid)) {
    MEMBERS[otherUuid].spouses.push(uuid);
  }
}

function editMember(uuid, data) {
  logger.info(`[${FILE}] editMember called`);

  if (!uuid in MEMBERS) {
    logger.error(`[${FILE}] uuid (${uuid}) not found`);
    throw new ExError(STATUS_CODE.CLIENT_ERROR);
  }

  const member = MEMBERS[uuid];
  const originalSpouses = [...(member.spouses || [])];

  // Update basic fields
  if (data.name !== undefined) {
    member.name = data.name;
  }
  if (data.gender !== undefined) {
    // empty string clears an explicit override, reverting to auto-inference
    member.gender = data.gender === "" ? undefined : data.gender;
  }
  if (data.born !== undefined) {
    member.born = data.born;
  }
  if (data.passed !== undefined) {
    member.passed = data.passed;
  }
  if (data.birthdate !== undefined) {
    member.birthdate = data.birthdate;
  }
  if (data.passedDate !== undefined) {
    member.passedDate = data.passedDate;
  }
  if (data.afterShkia !== undefined) {
    member.afterShkia = data.afterShkia;
  }
  if (data.hebrewNickname !== undefined) {
    member.hebrewNickname = data.hebrewNickname;
  }
  if (data.hebrewSurname !== undefined) {
    member.hebrewSurname = data.hebrewSurname;
  }
  if (data.englishNickname !== undefined) {
    member.englishNickname = data.englishNickname;
  }
  if (data.englishSurname !== undefined) {
    member.englishSurname = data.englishSurname;
  }
  if (data.calendarName !== undefined) {
    member.calendarName = data.calendarName;
  }
  if (data.notes !== undefined) {
    member.notes = data.notes === "" ? undefined : data.notes;
  }

  // Update father
  if (data.father !== undefined) {
    if (data.father === "" || data.father === null) {
      member.father = undefined;
    } else {
      // Check if the father name corresponds to the current father
      const currentFatherName =
        member.father && MEMBERS[member.father]
          ? MEMBERS[member.father].name
          : null;
      if (currentFatherName !== data.father) {
        // Only update if the name is different
        editFather(uuid, data.father);
      }
      // If the name is the same, keep the existing relationship
    }
  }

  // Update mother
  if (data.mother !== undefined) {
    if (data.mother === "" || data.mother === null) {
      member.mother = undefined;
    } else {
      // Check if the mother name corresponds to the current mother
      const currentMotherName =
        member.mother && MEMBERS[member.mother]
          ? MEMBERS[member.mother].name
          : null;
      if (currentMotherName !== data.mother) {
        // Only update if the name is different
        editMother(uuid, data.mother);
      }
      // If the name is the same, keep the existing relationship
    }
  }

  // Update spouses - handle complete replacement
  if (data.spouses !== undefined) {
    // Remove all existing spouse relationships
    originalSpouses.forEach((spouseUuid) => {
      if (MEMBERS[spouseUuid] && MEMBERS[spouseUuid].spouses) {
        MEMBERS[spouseUuid].spouses = MEMBERS[spouseUuid].spouses.filter(
          (s) => s !== uuid
        );
      }
    });

    // Clear member's spouse list
    member.spouses = [];

    // Add new spouses
    if (Array.isArray(data.spouses)) {
      data.spouses.forEach((spouseName) => {
        if (spouseName && spouseName.trim()) {
          addSpouse(uuid, spouseName.trim());
        }
      });
    }
  }
}

function editFather(uuid, father) {
  logger.info(`[${FILE}] editFather called`);

  if (!uuid in MEMBERS) {
    logger.error(`[${FILE}] uuid (${uuid}) not found`);
    throw new ExError(STATUS_CODE.CLIENT_ERROR);
  }

  if (R_UUID.test(father)) {
    logger.info(`[${FILE}] received father uuid (${father})`);
    if (father in MEMBERS) MEMBERS[uuid].father = father;
    else {
      logger.error(`[${FILE}] father uuid (${father}) not found`);
      throw new ExError(STATUS_CODE.CLIENT_ERROR);
    }
    return;
  }

  logger.info(`[${FILE}] received father name (${father})`);
  let fathers = search(father, false);
  if (fathers.length === 0) {
    logger.warn(`[${FILE}] creating father`);
    MEMBERS[uuid].father = add({ name: father });
  } else if (fathers.length > 1) {
    logger.error(`[${FILE}] more than one with same name`);
    throw new ExError(STATUS_CODE.CLIENT_ERROR);
  } else {
    MEMBERS[uuid].father = fathers[0].uuid;
  }
}

function editMother(uuid, mother) {
  logger.info(`[${FILE}] editMother called`);

  if (!uuid in MEMBERS) {
    logger.error(`[${FILE}] uuid (${uuid}) not found`);
    throw new ExError(STATUS_CODE.CLIENT_ERROR);
  }

  if (R_UUID.test(mother)) {
    logger.info(`[${FILE}] received mother uuid (${mother})`);
    if (mother in MEMBERS) MEMBERS[uuid].mother = mother;
    else {
      logger.error(`[${FILE}] mother uuid (${mother}) not found`);
      throw new ExError(STATUS_CODE.CLIENT_ERROR);
    }
    return;
  }

  logger.info(`[${FILE}] received mother name (${mother})`);
  let mothers = search(mother, false);
  if (mothers.length === 0) {
    logger.warn(`[${FILE}] creating mother`);
    MEMBERS[uuid].mother = add({ name: mother });
  } else if (mothers.length > 1) {
    logger.err(`[${FILE}] more than one with same name`);
    throw new ExError(STATUS_CODE.CLIENT_ERROR);
  } else {
    MEMBERS[uuid].mother = mothers[0].uuid;
  }
}

function load() {
  logger.info(`[${FILE}] load called`);

  let data = [];
  if (require("fs").existsSync(DATA_FILE)) {
    data = JSON.parse(require("fs").readFileSync(DATA_FILE, "utf8"));
  } else {
    logger.warn(`[${FILE}] ${DATA_FILE} not found - starting with an empty tree`);
  }

  data.map((member) => add(member));

  logger.info(`[${FILE}] loaded ${Object.keys(MEMBERS).length} members`);
}

async function dump() {
  logger.info(`[${FILE}] dump called`);

  let json = Object.entries(MEMBERS).map(([_, member]) => {
    return {
      name: member.name,
      gender: member.gender,
      father: member.father,
      mother: member.mother,
      spouses: member.spouses,
      uuid: member.uuid,
      born: member.born,
      passed: member.passed,
      references: member.references,
      birthdate: member.birthdate,
      passedDate: member.passedDate,
      afterShkia: member.afterShkia,
      hebrewNickname: member.hebrewNickname,
      hebrewSurname: member.hebrewSurname,
      englishNickname: member.englishNickname,
      englishSurname: member.englishSurname,
      calendarName: member.calendarName,
      notes: member.notes,
    };
  });

  await fs.writeFile(DATA_FILE, JSON.stringify(json), "utf8");
}

function search(name, substring = true, useFuzzy = false) {
  logger.info(`[${FILE}] search called with fuzzy: ${useFuzzy}`);

  const allMembers = Object.values(MEMBERS);

  if (useFuzzy) {
    // Use enhanced fuzzy search
    const searchResults = searchService.smartSearch(allMembers, name);

    // Remove duplicates based on UUID
    const uniqueResults = [];
    const seenUuids = new Set();

    for (const member of searchResults.all) {
      if (!seenUuids.has(member.uuid)) {
        seenUuids.add(member.uuid);
        uniqueResults.push(member);
      }
    }

    return uniqueResults.map((member) => formatSearchResult({ ...member }));
  } else {
    // Original search logic
    return allMembers
      .filter((member) =>
        substring ? member.name.includes(name) : member.name === name
      )
      .map((member) => formatSearchResult({ ...member }));
  }
}

function getMember(uuid) {
  logger.info(`[${FILE}] getMember called`);

  if (!uuid in MEMBERS) return {};

  return format({ ...MEMBERS[uuid] });
}

function getMemberFromName(name) {
  logger.info(`[${FILE}] getMemberFromName called`);

  let matches = Object.values(MEMBERS).filter((member) => member.name === name);
  if (matches.length > 1 || matches.length === 0) return;
  return format({ ...matches[0] });
}

function getName(uuid) {
  if (uuid in MEMBERS) return MEMBERS[uuid].name;
  else return undefined;
}

function getUuid(name) {
  let matches = Object.values(MEMBERS).filter((member) => member.name === name);
  if (matches.length > 1 || matches.length === 0) return;
  return matches[0].uuid;
}

function getAllMembers() {
  logger.info(`[${FILE}] getAllMembers called`);
  return Object.values(MEMBERS).map((member) => format({ ...member }));
}

module.exports = {
  add,
  edit,
  load,
  dump,
  search,
  getMember,
  getAllMembers,
  getMemberFromName,
  getName,
  getUuid,

  editMember,
  editName,
  removeSpouse,
  addSpouse,
  editFather,
  editMother,
};
