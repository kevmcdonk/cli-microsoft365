import { Cli, Logger } from '../../../../cli';
import {
  CommandOption
} from '../../../../Command';
import GlobalOptions from '../../../../GlobalOptions';
import request from '../../../../request';
import { spo, validation } from '../../../../utils';
import commands from '../../commands';
import { SpoAppBaseCommand } from './SpoAppBaseCommand';

interface CommandArgs {
  options: Options;
}

interface Options extends GlobalOptions {
  appCatalogUrl?: string;
  confirm?: boolean;
  id: string;
  scope?: string;
}

class SpoAppRemoveCommand extends SpoAppBaseCommand {
  public get name(): string {
    return commands.APP_REMOVE;
  }

  public get description(): string {
    return 'Removes the specified app from the specified app catalog';
  }

  public getTelemetryProperties(args: CommandArgs): any {
    const telemetryProps: any = super.getTelemetryProperties(args);
    telemetryProps.appCatalogUrl = (!(!args.options.appCatalogUrl)).toString();
    telemetryProps.confirm = (!(!args.options.confirm)).toString();
    telemetryProps.scope = args.options.scope || 'tenant';
    return telemetryProps;
  }

  public commandAction(logger: Logger, args: CommandArgs, cb: () => void): void {
    const scope: string = (args.options.scope) ? args.options.scope.toLowerCase() : 'tenant';

    const removeApp: () => void = (): void => {
      spo
        .getSpoUrl(logger, this.debug)
        .then((spoUrl: string): Promise<string> => {
          return this.getAppCatalogSiteUrl(logger, spoUrl, args);
        })
        .then((appCatalogUrl: string): Promise<void> => {
          if (this.debug) {
            logger.logToStderr(`Retrieved app catalog URL ${appCatalogUrl}. Removing app from the app catalog...`);
          }

          const requestOptions: any = {
            url: `${appCatalogUrl}/_api/web/${scope}appcatalog/AvailableApps/GetById('${encodeURIComponent(args.options.id)}')/remove`,
            headers: {
              accept: 'application/json;odata=nometadata'
            }
          };

          return request.post(requestOptions);
        })
        .then(_ => cb(), (rawRes: any): void => this.handleRejectedODataPromise(rawRes, logger, cb));
    };

    if (args.options.confirm) {
      removeApp();
    }
    else {
      Cli.prompt({
        type: 'confirm',
        name: 'continue',
        default: false,
        message: `Are you sure you want to remove the app ${args.options.id} from the app catalog?`
      }, (result: { continue: boolean }): void => {
        if (!result.continue) {
          cb();
        }
        else {
          removeApp();
        }
      });
    }
  }

  public options(): CommandOption[] {
    const options: CommandOption[] = [
      {
        option: '-i, --id <id>'
      },
      {
        option: '-u, --appCatalogUrl [appCatalogUrl]'
      },
      {
        option: '-s, --scope [scope]',
        autocomplete: ['tenant', 'sitecollection']
      },
      {
        option: '--confirm'
      }
    ];

    const parentOptions: CommandOption[] = super.options();
    return options.concat(parentOptions);
  }

  public validate(args: CommandArgs): boolean | string {
    // verify either 'tenant' or 'sitecollection' specified if scope provided
    if (args.options.scope) {
      const testScope: string = args.options.scope.toLowerCase();
      if (!(testScope === 'tenant' || testScope === 'sitecollection')) {
        return `Scope must be either 'tenant' or 'sitecollection' if specified`;
      }

      if (testScope === 'sitecollection' && !args.options.appCatalogUrl) {
        return `You must specify appCatalogUrl when the scope is sitecollection`;
      }
    }

    if (!validation.isValidGuid(args.options.id)) {
      return `${args.options.id} is not a valid GUID`;
    }

    if (args.options.appCatalogUrl) {
      return validation.isValidSharePointUrl(args.options.appCatalogUrl);
    }

    return true;
  }
}

module.exports = new SpoAppRemoveCommand();