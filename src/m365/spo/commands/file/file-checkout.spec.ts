import * as assert from 'assert';
import * as sinon from 'sinon';
import appInsights from '../../../../appInsights';
import auth from '../../../../Auth';
import { Logger } from '../../../../cli';
import Command, { CommandError } from '../../../../Command';
import request from '../../../../request';
import { sinonUtil } from '../../../../utils';
import commands from '../../commands';
const command: Command = require('./file-checkout');

describe(commands.FILE_CHECKOUT, () => {
  let log: any[];
  let logger: Logger;
  const stubPostResponses: any = (getFileByServerRelativeUrlResp: any = null, getFileByIdResp: any = null) => {
    return sinon.stub(request, 'post').callsFake((opts) => {
      if (getFileByServerRelativeUrlResp) {
        return getFileByServerRelativeUrlResp;
      }
      else {
        if ((opts.url as string).indexOf('/_api/web/GetFileByServerRelativeUrl(') > -1) {
          return Promise.resolve();
        }
      }

      if (getFileByIdResp) {
        return getFileByIdResp;
      }
      else {
        if ((opts.url as string).indexOf('/_api/web/GetFileById(') > -1) {
          return Promise.resolve();
        }
      }

      return Promise.reject('Invalid request');
    });
  };

  before(() => {
    sinon.stub(auth, 'restoreAuth').callsFake(() => Promise.resolve());
    sinon.stub(appInsights, 'trackEvent').callsFake(() => {});
    auth.service.connected = true;
  });

  beforeEach(() => {
    log = [];
    logger = {
      log: (msg: string) => {
        log.push(msg);
      },
      logRaw: (msg: string) => {
        log.push(msg);
      },
      logToStderr: (msg: string) => {
        log.push(msg);
      }
    };
  });

  afterEach(() => {
    sinonUtil.restore([
      request.post
    ]);
  });

  after(() => {
    sinonUtil.restore([
      auth.restoreAuth,
      appInsights.trackEvent
    ]);
    auth.service.connected = false;
  });

  it('has correct name', () => {
    assert.strictEqual(command.name.startsWith(commands.FILE_CHECKOUT), true);
  });

  it('has a description', () => {
    assert.notStrictEqual(command.description, null);
  });

  it('command correctly handles file get reject request', (done) => {
    const err = 'Invalid request';
    sinon.stub(request, 'post').callsFake((opts) => {
      if ((opts.url as string).indexOf('/_api/web/GetFileById') > -1) {
        return Promise.reject(err);
      }

      return Promise.reject('Invalid request');
    });

    command.action(logger, {
      options: {
        debug: true,
        webUrl: 'https://contoso.sharepoint.com',
        id: 'f09c4efe-b8c0-4e89-a166-03418661b89b'
      }
    }, (error?: any) => {
      try {
        assert.strictEqual(JSON.stringify(error), JSON.stringify(new CommandError(err)));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should handle checked out by someone else file',  (done) => {
    const expectedError: any = JSON.stringify({"odata.error":{"code":"-2130575306, Microsoft.SharePoint.SPFileCheckOutException","message":{"lang":"en-US","value":"The file \"https://contoso.sharepoint.com/sites/xx/Shared Documents/abc.txt\" is checked out for editing by i:0#.f|membership|xx"}}});
    const getFileByServerRelativeUrlResp: any = new Promise<any>((resolve, reject) => {
      return reject(expectedError);
    });
    stubPostResponses(getFileByServerRelativeUrlResp);

    const actionId: string = '0CD891EF-AFCE-4E55-B836-FCE03286CCCF';

    command.action(logger, {
      options: {
        verbose: true,
        id: actionId,
        webUrl: 'https://contoso.sharepoint.com/sites/project-x'
      }
    }, (err: any) => {
      try {
        assert.strictEqual(JSON.stringify(err.message), JSON.stringify(expectedError));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should handle file does not exist',  (done) => {
    const expectedError: any = JSON.stringify({"odata.error":{"code":"-2130575338, Microsoft.SharePoint.SPException","message":{"lang":"en-US","value":"Error: File Not Found."}}});
    const getFileByIdResp: any = new Promise<any>((resolve, reject) => {
      return reject(expectedError);
    });
    stubPostResponses(null, getFileByIdResp);

    const actionId: string = '0CD891EF-AFCE-4E55-B836-FCE03286CCCF';

    command.action(logger, {
      options: {
        verbose: true,
        id: actionId,
        webUrl: 'https://contoso.sharepoint.com/sites/project-x'
      }
    }, (err: any) => {
      try {
        assert.strictEqual(JSON.stringify(err.message), JSON.stringify(expectedError));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should call the correct API url when UniqueId option is passed', (done) => {
    const postStub: sinon.SinonStub = stubPostResponses();

    const actionId: string = '0CD891EF-AFCE-4E55-B836-FCE03286CCCF';

    command.action(logger, {
      options: {
        verbose: true,
        id: actionId,
        webUrl: 'https://contoso.sharepoint.com/sites/project-x'
      }
    }, () => {
      try {
        assert.strictEqual(postStub.lastCall.args[0].url, 'https://contoso.sharepoint.com/sites/project-x/_api/web/GetFileById(\'0CD891EF-AFCE-4E55-B836-FCE03286CCCF\')/checkout');
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should call the correct API url when URL option is passed', (done) => {
    const postStub: sinon.SinonStub = stubPostResponses();

    command.action(logger, {
      options: {
        debug: false,
        fileUrl: '/sites/project-x/Documents/Test1.docx',
        webUrl: 'https://contoso.sharepoint.com/sites/project-x'
      }
    }, () => {
      try {
        assert.strictEqual(postStub.lastCall.args[0].url, "https://contoso.sharepoint.com/sites/project-x/_api/web/GetFileByServerRelativeUrl('%2Fsites%2Fproject-x%2FDocuments%2FTest1.docx')/checkout");
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('should call the correct API url when tenant root URL option is passed', (done) => {
    const postStub: sinon.SinonStub = stubPostResponses();

    command.action(logger, {
      options: {
        debug: false,
        fileUrl: '/Documents/Test1.docx',
        webUrl: 'https://contoso.sharepoint.com'
      }
    }, () => {
      try {
        assert.strictEqual(postStub.lastCall.args[0].url, "https://contoso.sharepoint.com/_api/web/GetFileByServerRelativeUrl('%2FDocuments%2FTest1.docx')/checkout");
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('supports debug mode', () => {
    const options = command.options();
    let containsDebugOption = false;
    options.forEach(o => {
      if (o.option === '--debug') {
        containsDebugOption = true;
      }
    });
    assert(containsDebugOption);
  });

  it('supports specifying URL', () => {
    const options = command.options();
    let containsTypeOption = false;
    options.forEach(o => {
      if (o.option.indexOf('<webUrl>') > -1) {
        containsTypeOption = true;
      }
    });
    assert(containsTypeOption);
  });

  it('fails validation if the webUrl option is not a valid SharePoint site URL', () => {
    const actual = command.validate({ options: { webUrl: 'foo', id: 'f09c4efe-b8c0-4e89-a166-03418661b89b' } });
    assert.notStrictEqual(actual, true);
  });

  it('passes validation if the webUrl option is a valid SharePoint site URL', () => {
    const actual = command.validate({ options: { webUrl: 'https://contoso.sharepoint.com', id: 'f09c4efe-b8c0-4e89-a166-03418661b89b' } });
    assert.strictEqual(actual, true);
  });

  it('fails validation if the id option is not a valid GUID', () => {
    const actual = command.validate({ options: { webUrl: 'https://contoso.sharepoint.com', id: '12345' } });
    assert.notStrictEqual(actual, true);
  });

  it('passes validation if the id option is a valid GUID', () => {
    const actual = command.validate({ options: { webUrl: 'https://contoso.sharepoint.com', id: 'f09c4efe-b8c0-4e89-a166-03418661b89b' } });
    assert(actual);
  });

  it('fails validation if the id or url option not specified', () => {
    const actual = command.validate({ options: { webUrl: 'https://contoso.sharepoint.com' } });
    assert.notStrictEqual(actual, true);
  });

  it('fails validation if both id and fileUrl options are specified', () => {
    const actual = command.validate({ options: { webUrl: 'https://contoso.sharepoint.com', id: 'f09c4efe-b8c0-4e89-a166-03418661b89b', fileUrl: '/sites/project-x/documents' } });
    assert.notStrictEqual(actual, true);
  });
});
