import dedent from 'dedent';
import * as pc from 'picocolors';
import { messagePrompt } from '../utils/prompts';
import { fileExistsWorkspace, readFile } from '../files/utils';
import type { Workspace } from '../utils/workspace';
import type { AdderCheckConfig, AdderConfig } from './config';
import type { OptionDefinition } from './options';

export type PreconditionParameters<Args extends OptionDefinition> = {
	workspace: Workspace<Args>;
	fileExists: (path: string) => void;
	fileContains: (path: string, expectedContent: string) => void;
};
export type Postcondition<Args extends OptionDefinition> = {
	name: string;
	run: (params: PreconditionParameters<Args>) => Promise<void> | void;
};

export async function checkPostconditions<Args extends OptionDefinition>(
	config: AdderConfig<Args>,
	checks: AdderCheckConfig<Args>,
	workspace: Workspace<Args>,
	multipleAdders: boolean
): Promise<string[]> {
	const postconditions = checks.postconditions ?? [];
	const unmetPostconditions: string[] = [];

	for (const postcondition of postconditions) {
		try {
			await postcondition.run({
				workspace,
				fileExists: (path) => fileExists(path, workspace),
				fileContains: (path, expectedContent) => fileContains(path, workspace, expectedContent)
			});
		} catch (error) {
			const typedError = error as Error;
			const message = `${postcondition.name} (${typedError.message})`;
			unmetPostconditions.push(`${multipleAdders ? config.metadata.id + ': ' : ''}${message}`);
		}
	}

	return unmetPostconditions;
}

function fileExists<Args extends OptionDefinition>(path: string, workspace: Workspace<Args>) {
	if (fileExistsWorkspace(workspace, path)) return;

	throw new Error(`File "${path}" does not exists`);
}

function fileContains<Args extends OptionDefinition>(
	path: string,
	workspace: Workspace<Args>,
	expectedContent: string
): void {
	fileExists(path, workspace);

	const content = readFile(workspace, path);
	if (content && content.includes(expectedContent)) return;

	throw new Error(`File "${path}" does not contain "${expectedContent}"`);
}

export function printUnmetPostconditions(unmetPostconditions: string[]): void {
	const postconditionList = unmetPostconditions.map((x) => pc.yellow(`- ${x}`)).join('\n');
	const additionalText = dedent`
		Postconditions are not supposed to fail.
		Please open an issue providing the full console output:
		https://github.com/sveltejs/cli/issues/new/choose
	`;

	messagePrompt('Postconditions not met', `${postconditionList}\n\n${additionalText}`);
}
