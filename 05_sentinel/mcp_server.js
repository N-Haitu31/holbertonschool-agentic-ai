import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
	{
		name: "github-issues-server",
		version: "1.0.0",
	},
	{
		capabilities: {
			tools: {},
		},
	},
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
	tools: [
		{
			name: "fetch_github_issues",
			description: "Fetch the five latest issues from a GitHub repository.",
			inputSchema: {
				type: "object",
				properties: {
					owner: {
						type: "string",
						description: "GitHub repository owner or organization.",
					},
					repo: {
						type: "string",
						description: "GitHub repository name.",
					},
				},
				required: ["owner", "repo"],
				additionalProperties: false,
			},
		},
	],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
	if (request.params.name !== "fetch_github_issues") {
		throw new Error(`Unknown tool: ${request.params.name}`);
	}

	const { owner, repo } = request.params.arguments ?? {};

	if (
		typeof owner !== "string" ||
		owner.trim() === "" ||
		typeof repo !== "string" ||
		repo.trim() === ""
	) {
		return {
			isError: true,
			content: [
				{
					type: "text",
					text: "owner and repo are required non-empty strings.",
				},
			],
		};
	}

	const url = new URL(
		`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
	);
	url.searchParams.set("per_page", "5");
	url.searchParams.set("page", "1");

	try {
		const headers = {
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
		};

		if (process.env.GITHUB_TOKEN) {
			headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
		}

		const response = await fetch(url, { headers });

		if (!response.ok) {
			return {
				isError: true,
				content: [
					{
						type: "text",
						text: `GitHub API error (${response.status} ${response.statusText}).`,
					},
				],
			};
		}

		const issues = await response.json();

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(issues.slice(0, 5), null, 2),
				},
			],
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown network error";

		return {
			isError: true,
			content: [
				{
					type: "text",
					text: `Unable to reach GitHub: ${message}`,
				},
			],
		};
	}
});

const transport = new StdioServerTransport();
await server.connect(transport);
