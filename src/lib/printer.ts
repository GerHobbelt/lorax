'use strict';

/**
 * @name printer
 * @description
 * Printing parsed data back into readable format
 */

import * as util from 'util';
import {template} from './template';

import {Config} from './config';

import type {Configuration, DisplayConfiguration} from './config';
import type {Commit} from './parser';
import type {LoraxOptions} from '../lorax';

type PrintSection = {
  [P in keyof DisplayConfiguration]: {
    [component: string]: Array<Commit>;
  };
};

let hasWarnedAboutMissingUrl = false;

function checkAndWarnAboutMissingUrl(url: string | null | undefined) {
  if (!url && !hasWarnedAboutMissingUrl) {
    console.error(`

###########################################################################
#                            WARNING                                      #
# The project URL is unknown/unidentifiable.                              #
# Please provide a base URL in your lorax.json configuration file!        #
###########################################################################
    
    `);
    hasWarnedAboutMissingUrl = true;
  }
}

class Printer {
  private commits: Array<Commit>;
  private version: string;
  private config: Config;

  constructor(commits: Array<Commit>, version: string, config: Config) {
    this.commits = commits;
    this.version = version;
    this.config = config;
  }

  /**
   * @description
   * Create a markdown link to issue page with issue number as text
   */
  linkToIssue(issue: number): string {
    if (!issue) return '';

    const url: Configuration['url'] = this.config.get('url');
    const issueTmpl: Configuration['issue'] = this.config.get('issue');

    checkAndWarnAboutMissingUrl(url);

    let issueLink = template.ISSUE;
    if (url && issueTmpl) {
      issueLink = util.format(template.LINK_TO_ISSUE, issue, url, issueTmpl);
    }

    return util.format(issueLink, issue);
  }

  /**
   * @function
   * @name linkToCommit
   * @description
   * Create a markdown link to commit page with commit hash as text
   */
  linkToCommit(hash: string): string {
    if (!hash) return '';

    const url: Configuration['url'] = this.config.get('url');
    const commitTmpl: Configuration['commit'] = this.config.get('commit');

    checkAndWarnAboutMissingUrl(url);

    let commitLink = template.COMMIT;
    const shortenHash = hash.substr(0, 8);
    if (url && commitTmpl) {
      commitLink = util.format(
        template.LINK_TO_COMMIT,
        shortenHash,
        url,
        commitTmpl
      );
    }

    return util.format(commitLink, shortenHash);
  }

  /**
   * @description
   * Using preprocessed array of commits, render a changelog in markdown format with version
   * and today's date as the header
   */
  print(options?: LoraxOptions): string {
    const lines: Array<string> = [];
    const sections = {} as PrintSection;
    const display: DisplayConfiguration = this.config.get('display');

    options = options || {};

    // Header section
    const timestamp = options.timestamp || new Date();
    lines.push(
      util.format(
        template.HEADER,
        this.version,
        timestamp.getFullYear(),
        timestamp.getMonth() + 1,
        timestamp.getDate()
      )
    );

    for (const key in display) {
      sections[key] = {};
    }

    this.commits.forEach((commit: Commit) => {
      const {component, type} = commit;

      if (!sections[type]) {
        sections[type] = {};
      }
      const section = sections[type];
      if (!section[component]) {
        section[component] = [];
      }
      section[component].push(commit);
    });

    for (const sectionType in sections) {
      const list = sections[sectionType];
      const components = Object.getOwnPropertyNames(list).sort();
      if (!components.length) {
        continue;
      }

      // skip type?
      if (display[sectionType] === false) {
        continue;
      }

      const title =
        display[sectionType] ||
        sectionType.replace(/^./, (m) => m.toUpperCase());

      lines.push(util.format(template.SECTION_HEADER, title));

      components.forEach((componentName: string) => {
        const componentList = list[componentName] || [];

        const title = util.format(
          template.COMPONENT_TITLE,
          componentName === '?'
            ? 'any'
            : componentName === '*'
            ? 'all'
            : componentName
        );
        const hasOneItem = componentList.length == 1;
        componentList.forEach((item, index) => {
          if (!hasOneItem && !index) lines.push(title);

          const prefix = hasOneItem && !index ? title : template.COMPONENT_ITEM;
          const msgLines = item.message.split('\n');
          // if the commit message looks like a Markdown LIST, then do not dump it on the first line:
          if (msgLines[0].match(/^- [^\s]+/)) {
            msgLines.unshift('Changes:');
          }
          lines.push(util.format(template.COMPONENT_LINE, prefix, msgLines[0]));
          for (let i = 1; i < msgLines.length; i++) {
            lines.push(
              (!hasOneItem ? template.COMPONENT_ITEM_CONTINUATION_PREFIX : '') +
                template.COMPONENT_ITEM_CONTINUATION_PREFIX +
                msgLines[i]
            );
          }

          const additionalInfo = item.issues.map((issue) =>
            this.linkToIssue(issue)
          );
          additionalInfo.unshift(this.linkToCommit(item.hash));

          lines.push(
            (!hasOneItem ? template.COMPONENT_ITEM_CONTINUATION_PREFIX : '') +
              util.format(
                template.COMMIT_ADDITIONAL_INFO,
                additionalInfo.join(
                  ',\n   ' +
                    (!hasOneItem
                      ? template.COMPONENT_ITEM_CONTINUATION_PREFIX
                      : '')
                )
              )
          );
        });
      });

      lines.push('');
    }

    // Add 2 new lines
    lines.push('', '');
    return lines.join('\n');
  }
}

export {Printer};
