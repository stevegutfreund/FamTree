const memberService = require("../services/member.service");
const { Router } = require("./route");

let router = new Router({ topic: "members" });

// Get children of a specific member
router.route({
  topic: ":uuid/children",
  method: "get",
  name: "getChildren",
  route: "/:uuid/children",
  cbs: [
    async (req, res) => {
      try {
        const { uuid } = req.params;
        console.log(`[CHILDREN API] Looking for children of member: ${uuid}`);

        // Get all members
        const allMembers = memberService.getAllMembers();
        console.log(
          `[CHILDREN API] Total members in system: ${allMembers.length}`
        );

        // Find children where this member is either father or mother
        const children = allMembers.filter((member) => {
          const fatherUuid = member.father
            ? extractUUIDFromUrl(member.father)
            : null;
          const motherUuid = member.mother
            ? extractUUIDFromUrl(member.mother)
            : null;
          return fatherUuid === uuid || motherUuid === uuid;
        });

        console.log(
          `[CHILDREN API] Found ${children.length} children for member ${uuid}`
        );

        // Group children by the other parent (spouse)
        const childrenBySpouse = [];

        for (const child of children) {
          // Determine the other parent
          let otherParentId = null;
          const fatherUuid = child.father
            ? extractUUIDFromUrl(child.father)
            : null;
          const motherUuid = child.mother
            ? extractUUIDFromUrl(child.mother)
            : null;

          if (fatherUuid === uuid) {
            // This member is the father, find the mother
            otherParentId = motherUuid;
          } else if (motherUuid === uuid) {
            // This member is the mother, find the father
            otherParentId = fatherUuid;
          }

          // Find existing group or create new one
          let spouseGroup = childrenBySpouse.find(
            (group) => group.spouseId === otherParentId
          );
          if (!spouseGroup) {
            // Get spouse information if available
            let spouse = null;
            if (otherParentId) {
              try {
                spouse = memberService.getMember(otherParentId);
              } catch (error) {
                console.error("Error fetching spouse:", error);
              }
            }

            spouseGroup = {
              spouseId: otherParentId,
              spouse: spouse,
              children: [],
            };
            childrenBySpouse.push(spouseGroup);
          }

          spouseGroup.children.push(child);
        }

        console.log(
          `[CHILDREN API] Returning ${childrenBySpouse.length} spouse groups with children`
        );
        res.json(childrenBySpouse);
      } catch (error) {
        console.error("Error fetching children:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    },
  ],
  authorization: false,
});

// Helper function to extract UUID from URL
function extractUUIDFromUrl(url) {
  if (!url) return null;
  if (!url.includes("/")) return url; // Already a UUID
  const parts = url.split("/");
  return parts[parts.length - 1];
}

module.exports = router;
