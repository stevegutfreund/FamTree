const memberService = require("../services/member.service");

const FILE = "MEMBER.CONTROLLER";

module.exports = {
  addMember,
  loadMembersFromFile,
  dumpMembersToFile,
  search,
  getMember,

  editMember,
  editName,
  addSpouse,
  removeSpouse,
  editFather,
  editMother,
};

async function addMember(req, res, next) {
  logger.info(`[${FILE}] got a addMember request`);

  try {
    let uuid = memberService.add(req.body);
    await memberService.dump();
    res.status(200).json(uuid);
  } catch (e) {
    next(e);
  }
}

async function loadMembersFromFile(req, res, next) {
  logger.info(`[${FILE}] got a loadMembersFromFile request`);

  try {
    var data = JSON.parse(req.file.buffer.toString());
    await memberService.addFromJson(data);
    res.status(200).json();
  } catch (e) {
    next(e);
  }
}

async function dumpMembersToFile(req, res, next) {
  logger.info(`[${FILE}] got a dumpMembersToFile request`);

  try {
    await memberService.dump();
    res.status(200).json();
  } catch (e) {
    next(e);
  }
}

async function search(req, res, next) {
  logger.info(`[${FILE}] search request`);
  try {
    let members;
    if (req.query.name) {
      // Search with name filter using fuzzy search
      members = memberService.search(req.query.name, true, true);
    } else {
      // Return all members
      members = memberService.getAllMembers();
    }
    res.status(200).json(members);
  } catch (e) {
    next(e);
  }
}

async function getMember(req, res, next) {
  logger.info(`[${FILE}] getMember request`);
  try {
    let member = memberService.getMember(req.params.uuid);
    res.status(200).json(member);
  } catch (e) {
    next(e);
  }
}

async function editMember(req, res, next) {
  logger.info(`[${FILE}] editMember request`);
  try {
    memberService.editMember(req.params.uuid, req.body);
    await memberService.dump();
    res.status(200).json();
  } catch (e) {
    next(e);
  }
}

async function editName(req, res, next) {
  logger.info(`[${FILE}] editName request`);
  try {
    memberService.editName(req.params.uuid, req.body.name);
    res.status(200).json();
  } catch (e) {
    next(e);
  }
}

async function addSpouse(req, res, next) {
  logger.info(`[${FILE}] addSpouse request`);
  try {
    memberService.addSpouse(req.params.uuid, req.body.name);
    res.status(200).json();
  } catch (e) {
    next(e);
  }
}

async function removeSpouse(req, res, next) {
  logger.info(`[${FILE}] removeSpouse request`);
  try {
    memberService.removeSpouse(req.params.uuid, req.body.name);
    res.status(200).json();
  } catch (e) {
    next(e);
  }
}

async function editFather(req, res, next) {
  logger.info(`[${FILE}] editFather request`);
  try {
    memberService.editFather(req.params.uuid, req.body.name);
    res.status(200).json();
  } catch (e) {
    next(e);
  }
}

async function editMother(req, res, next) {
  logger.info(`[${FILE}] editMother request`);
  try {
    memberService.editMother(req.params.uuid, req.body.name);
    res.status(200).json();
  } catch (e) {
    next(e);
  }
}
