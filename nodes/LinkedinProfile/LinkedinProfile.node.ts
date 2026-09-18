import type {
	IExecuteFunctions,
	IHttpRequestMethods,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IRequestOptions,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

const ACTOR_ID = 'apivault_labs~linkedin-profile-scraper-no-cookies';
const API_BASE = 'https://api.apify.com/v2';
const TERMINAL_STATUSES = new Set(['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT']);

const splitList = (value: string): string[] =>
	value.split(/[,\n]+/).map((item) => item.trim()).filter(Boolean);

const sleep = async (milliseconds: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, milliseconds));

export class LinkedinProfile implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'LinkedIn Profile Scraper',
		name: 'linkedinProfile',
		icon: 'file:linkedinprofile.svg',
		group: ['transform'],
		version: 1,
		description: 'Extract available public LinkedIn profile data without supplying login cookies.',
		defaults: { name: 'LinkedIn Profile Scraper' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'apifyApi', required: true }],
		properties: [
			{
				displayName: 'LinkedIn URLs or Usernames',
				name: 'profileUrls',
				type: 'string',
				typeOptions: { rows: 6 },
				default: '',
				placeholder: 'https://www.linkedin.com/in/public-handle/\nsecond-handle',
				description: 'One public /in/ URL or username per line. Commas are also accepted. Up to 100 unique profiles per run.',
			},
			{
				displayName: 'CRM Records',
				name: 'crmProfiles',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				placeholder: 'Add CRM Record',
				default: {},
				description: 'Optional URLs with caller-provided IDs copied to output as inputId',
				options: [{
					displayName: 'Record',
					name: 'records',
					values: [
						{
							displayName: 'LinkedIn URL or Username', name: 'url', type: 'string', default: '', required: true,
							placeholder: 'https://www.linkedin.com/in/public-handle/',
						},
						{
							displayName: 'Correlation ID', name: 'id', type: 'string', default: '',
							description: 'Optional CRM identifier returned unchanged as inputId',
						},
					],
				}],
			},
			{
				displayName: 'Add Research Signals', name: 'enrich', type: 'boolean', default: true,
				description: 'Whether to derive seniority, tenure and lead-research signals from available public fields',
			},
			{
				displayName: 'Output Format', name: 'exportFormat', type: 'options',
				options: [
					{ name: 'Full Profile (Nested JSON)', value: 'default' },
					{ name: 'Flat Row (CSV / CRM)', value: 'flat' },
				],
				default: 'default',
				description: 'Choose complete nested output or a flat CRM-friendly row',
			},
			{
				displayName: 'Parallel Profiles', name: 'maxConcurrency', type: 'number',
				typeOptions: { minValue: 1, maxValue: 10 }, default: 5,
				description: 'Maximum profiles processed at the same time',
			},
			{
				displayName: 'Maximum Time per Profile (Seconds)', name: 'timeout', type: 'number',
				typeOptions: { minValue: 20, maxValue: 120 }, default: 60,
				description: 'Stop waiting for an unavailable profile after this time and continue the batch',
			},
			{
				displayName: 'Run Demo When Input Is Empty', name: 'useDemoOnEmpty', type: 'boolean', default: false,
				description: 'When enabled, an empty run processes one public demo profile and may bill one successful result',
			},
			{
				displayName: 'Execution', name: 'execution', type: 'collection', placeholder: 'Add Option', default: {},
				options: [
					{
						displayName: 'Maximum Wait (Seconds)', name: 'maxWaitSeconds', type: 'number',
						typeOptions: { minValue: 60, maxValue: 1800 }, default: 600,
						description: 'Maximum time n8n waits for the complete Actor run',
					},
					{
						displayName: 'Poll Interval (Seconds)', name: 'pollIntervalSeconds', type: 'number',
						typeOptions: { minValue: 2, maxValue: 30 }, default: 5,
						description: 'How often to check the Actor run status',
					},
					{
						displayName: 'Wait for Results', name: 'waitForResults', type: 'boolean', default: true,
						description: 'Turn off to immediately return run metadata for a separate polling workflow',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const profileUrls = splitList(this.getNodeParameter('profileUrls', itemIndex, '') as string);
				const crmProfiles = this.getNodeParameter('crmProfiles', itemIndex, {}) as {
					records?: Array<{ url?: string; id?: string }>;
				};
				const profiles = (crmProfiles.records ?? []).map((record) => ({
					url: (record.url ?? '').trim(), id: (record.id ?? '').trim(),
				})).filter((record) => record.url.length > 0);
				const useDemoOnEmpty = this.getNodeParameter('useDemoOnEmpty', itemIndex, false) as boolean;
				const totalInputs = profileUrls.length + profiles.length;
				if (totalInputs === 0 && !useDemoOnEmpty) {
					throw new NodeOperationError(this.getNode(), 'Provide at least one LinkedIn profile or explicitly enable the demo', { itemIndex });
				}
				if (totalInputs > 100) {
					throw new NodeOperationError(this.getNode(), 'A run accepts at most 100 combined profile inputs', { itemIndex });
				}

				const body = {
					profileUrls,
					profiles,
					enrich: this.getNodeParameter('enrich', itemIndex, true) as boolean,
					exportFormat: this.getNodeParameter('exportFormat', itemIndex, 'default') as string,
					maxConcurrency: this.getNodeParameter('maxConcurrency', itemIndex, 5) as number,
					timeout: this.getNodeParameter('timeout', itemIndex, 60) as number,
					useDemoOnEmpty,
				};
				const execution = this.getNodeParameter('execution', itemIndex, {}) as {
					waitForResults?: boolean; maxWaitSeconds?: number; pollIntervalSeconds?: number;
				};
				const started = await this.helpers.requestWithAuthentication.call(this, 'apifyApi', {
					method: 'POST' as IHttpRequestMethods, url: `${API_BASE}/acts/${ACTOR_ID}/runs`, body, json: true,
				} as IRequestOptions);
				let run = started?.data ?? started;
				if (!run?.id) throw new NodeOperationError(this.getNode(), 'Apify did not return a run ID', { itemIndex });
				if (execution.waitForResults === false) {
					returnData.push({ json: run, pairedItem: { item: itemIndex } });
					continue;
				}

				const deadline = Date.now() + (execution.maxWaitSeconds ?? 600) * 1000;
				const pollMilliseconds = (execution.pollIntervalSeconds ?? 5) * 1000;
				while (!TERMINAL_STATUSES.has(run.status) && Date.now() < deadline) {
					await sleep(pollMilliseconds);
					const statusResponse = await this.helpers.requestWithAuthentication.call(this, 'apifyApi', {
						method: 'GET' as IHttpRequestMethods, url: `${API_BASE}/actor-runs/${run.id}`, json: true,
					} as IRequestOptions);
					run = statusResponse?.data ?? statusResponse;
				}
				if (!TERMINAL_STATUSES.has(run.status)) {
					throw new NodeOperationError(this.getNode(), `Actor run ${run.id} is still running after ${execution.maxWaitSeconds ?? 600} seconds`, { itemIndex });
				}
				if (run.status !== 'SUCCEEDED') {
					throw new NodeOperationError(this.getNode(), `Actor run ${run.id} finished with status ${run.status}`, { itemIndex });
				}
				if (!run.defaultDatasetId) {
					throw new NodeOperationError(this.getNode(), 'Completed run has no dataset ID', { itemIndex });
				}
				const response = await this.helpers.requestWithAuthentication.call(this, 'apifyApi', {
					method: 'GET' as IHttpRequestMethods,
					url: `${API_BASE}/datasets/${run.defaultDatasetId}/items`,
					qs: { clean: true, format: 'json' }, json: true,
				} as IRequestOptions);
				const results = Array.isArray(response) ? response : [response];
				for (const result of results) returnData.push({ json: result, pairedItem: { item: itemIndex } });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: itemIndex } });
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
			}
		}
		return [returnData];
	}
}
