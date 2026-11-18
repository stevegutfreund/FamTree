const memberCtrl = require("../controllers/member.controller");
const Joi = require("joi");
const { requireAuth, optionalAuth } = require("../middleware/auth");

const { Router } = require("./route");
let router = new Router({ topic: "members" });

// ROUTES

router.route({
  topic: "",
  method: "post",
  name: "add",
  route: "/",
  body: Joi.object({
    name: Joi.string().required(),
    gender: Joi.string().valid("male", "female", "").optional(),
    spouses: Joi.array().items(Joi.string()).optional(),
    father: Joi.string().optional(),
    mother: Joi.string().optional(),
    born: Joi.number().integer().optional(),
    passed: Joi.number().integer().optional(),
    birthdate: Joi.string().optional(),
    passedDate: Joi.string().optional(),
    afterShkia: Joi.boolean().optional(),
    hebrewNickname: Joi.string().optional(),
    hebrewSurname: Joi.string().optional(),
    englishNickname: Joi.string().optional(),
    englishSurname: Joi.string().optional(),
    calendarName: Joi.string().optional(),
    notes: Joi.string().allow("").max(10000).optional(),
  }),
  cbs: [requireAuth, memberCtrl.addMember], // Authentication required for adding
  authorization: false,
  example: {
    body: {
      name: "אברהם",
      spouses: ["שרה"],
      father: "תרח",
      mother: "אמתלאי",
      born: 150,
      passed: 350,
      birthdate: "150-01-01",
      afterShkia: false,
      hebrewNickname: "אברם",
      englishNickname: "Abraham",
      englishSurname: "",
      calendarName: "Abraham",
    },
  },
});

router.route({
  topic: "",
  name: "edit member",
  method: "put",
  route: "/:uuid",
  body: Joi.object({
    name: Joi.string().optional(),
    gender: Joi.string().valid("male", "female", "").optional(),
    spouses: Joi.array().items(Joi.string()).optional(),
    father: Joi.string().optional(),
    mother: Joi.string().optional(),
    born: Joi.number().integer().optional(),
    passed: Joi.number().integer().optional(),
    birthdate: Joi.string().optional(),
    passedDate: Joi.string().optional(),
    afterShkia: Joi.boolean().optional(),
    hebrewNickname: Joi.string().optional(),
    hebrewSurname: Joi.string().optional(),
    englishNickname: Joi.string().optional(),
    englishSurname: Joi.string().optional(),
    calendarName: Joi.string().optional(),
    notes: Joi.string().allow("").max(10000).optional(),
  }),
  cbs: [memberCtrl.editMember],
  authorization: false,
  example: {
    params: { uuid: "20da6776-bf2b-45ff-8b38-b5d3535e4153" },
    body: {
      name: "אברהם",
      spouses: ["שרה", "הגר"],
      father: "תרח",
      mother: "אמתלאי",
      born: 150,
      passed: 350,
      birthdate: "150-01-01",
      afterShkia: false,
      hebrewNickname: "אברם",
      englishNickname: "Abraham",
      englishSurname: "",
      calendarName: "Abraham",
    },
  },
});

router.route({
  topic: "",
  name: "edit name",
  method: "post",
  route: "/:uuid/name",
  body: Joi.object({
    name: Joi.string().optional(),
  }),
  cbs: [memberCtrl.editName],
  authorization: false,
  example: {
    params: { uuid: "20da6776-bf2b-45ff-8b38-b5d3535e4153" },
    body: { name: "אברם" },
  },
});

router.route({
  topic: "",
  name: "add spouse",
  method: "post",
  route: "/:uuid/spouse",
  body: Joi.object({
    name: Joi.string().optional(),
  }),
  cbs: [memberCtrl.addSpouse],
  authorization: false,
  example: {
    params: { uuid: "20da6776-bf2b-45ff-8b38-b5d3535e4153" },
    body: { name: "שרה" },
  },
});

router.route({
  topic: "",
  name: "remove spouse",
  method: "delete",
  route: "/:uuid/spouse",
  body: Joi.object({
    name: Joi.string().optional(),
  }),
  cbs: [memberCtrl.removeSpouse],
  authorization: false,
  example: {
    params: { uuid: "20da6776-bf2b-45ff-8b38-b5d3535e4153" },
    body: { name: "שרה" },
  },
});

router.route({
  topic: "",
  name: "edit father",
  method: "post",
  route: "/:uuid/father",
  body: Joi.object({
    name: Joi.string().optional(),
  }),
  cbs: [memberCtrl.editFather],
  authorization: false,
  example: {
    params: { uuid: "20da6776-bf2b-45ff-8b38-b5d3535e4153" },
    body: { name: "תרח" },
  },
});

router.route({
  topic: "",
  name: "edit mother",
  method: "post",
  route: "/:uuid/mother",
  body: Joi.object({
    name: Joi.string().optional(),
  }),
  cbs: [memberCtrl.editMother],
  authorization: false,
  example: {
    params: { uuid: "20da6776-bf2b-45ff-8b38-b5d3535e4153" },
    body: { name: "אמתלאי" },
  },
});

router.route({
  topic: "",
  name: "search",
  method: "get",
  route: "/",
  query: Joi.object({
    name: Joi.string().optional(),
  }),
  cbs: [memberCtrl.search],
  authorization: false,
  example: {
    query: { name: "אברהם" },
  },
});

router.route({
  topic: "",
  name: "get member",
  method: "get",
  route: "/:uuid",
  params: Joi.object({
    uuid: Joi.string().required(),
  }),
  cbs: [memberCtrl.getMember],
  authorization: false,
  example: {
    params: { uuid: "20da6776-bf2b-45ff-8b38-b5d3535e4153" },
  },
});

router.route({
  topic: "",
  method: "post",
  name: "dump",
  route: "/dump",
  cbs: [memberCtrl.dumpMembersToFile],
  authorization: false,
});

module.exports = router;
