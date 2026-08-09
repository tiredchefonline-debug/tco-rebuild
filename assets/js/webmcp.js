(function () {
  "use strict";

  if (!document.modelContext || typeof document.modelContext.registerTool !== "function") return;

  const recommendations = {
    local_visibility: {
      service: "Local SEO",
      summary: "Improve visibility and trust when nearby customers search in Google Search and Maps.",
      url: "https://tiredchefonline.com/services/local-seo.html"
    },
    website_clarity_or_conversion: {
      service: "Web Design",
      summary: "Create a faster, clearer path from a visitor's first question to a call, booking, or inquiry.",
      url: "https://tiredchefonline.com/services/web-design.html"
    },
    social_content_consistency: {
      service: "Social Media",
      summary: "Build a sustainable content system connected to offers, customer questions, and useful actions.",
      url: "https://tiredchefonline.com/services/social-media.html"
    },
    not_sure: {
      service: "Discovery",
      summary: "Start with the business goal and current friction so TiredChefOnline can recommend the most useful first step.",
      url: "https://tiredchefonline.com/contact.html"
    }
  };

  const tools = [
    {
      name: "find_relevant_service",
      title: "Find a relevant TiredChefOnline service",
      description: "Recommends the TiredChefOnline service that best matches a business goal and returns the canonical service page. Use this when someone is unsure whether they need Local SEO, web design, or social media support.",
      inputSchema: {
        type: "object",
        properties: {
          goal: {
            type: "string",
            enum: [
              "local_visibility",
              "website_clarity_or_conversion",
              "social_content_consistency",
              "not_sure"
            ],
            description: "The primary business goal to improve."
          }
        },
        required: ["goal"],
        additionalProperties: false
      },
      annotations: {
        readOnlyHint: true,
        untrustedContentHint: false
      },
      execute: function (input) {
        const recommendation = recommendations[input.goal] || recommendations.not_sure;
        return {
          content: [
            {
              type: "text",
              text: `${recommendation.service}: ${recommendation.summary} Learn more at ${recommendation.url}`
            }
          ]
        };
      }
    }
  ];

  tools.forEach(function (tool) {
    try {
      const registration = document.modelContext.registerTool(tool);
      if (registration && typeof registration.catch === "function") {
        registration.catch(function () {
          // WebMCP is experimental; the normal website remains fully functional
          // when registration is unavailable or denied by the browser.
        });
      }
    } catch (error) {
      // Ignore unsupported experimental implementations without affecting users.
    }
  });
})();
