import {test} from 'node:test';
import assert from 'node:assert/strict';
import {connectionDiagnostics} from '../shared/connection-diagnostics.js';

test('connection details include only permitted metadata', () => {
  assert.deepEqual(connectionDiagnostics({phase:'requirements',status:403,code:'request_rejected',requestId:'request-123',prompt:'Private source',Authorization:'Bearer secret',apiKey:'secret',cookie:'session=secret',message:'Private provider response'},'1.9.6'), {
    stage:'Request preparation',httpStatus:403,code:'request_rejected',requestId:'request-123',extensionVersion:'1.9.6'
  });
});

test('unknown or malformed connection fields are excluded', () => {
  assert.equal(connectionDiagnostics({phase:'Private prompt',status:'200',code:'contains private spaces',requestId:'<script>'},'1.9.6'),null);
  assert.equal(connectionDiagnostics(null,'1.9.6'),null);
  assert.equal(connectionDiagnostics({phase:'toString'},'1.9.6'),null);
});

test('stream errors describe their stage and preserve a safe error code', () => {
  assert.deepEqual(connectionDiagnostics({phase:'response',status:200,error:{code:'temporary_failure'}},'1.9.6'), {
    stage:'Receiving the response',httpStatus:200,code:'temporary_failure',extensionVersion:'1.9.6'
  });
});

test('the automatic model identifier is included for rejection troubleshooting', () => {
  assert.deepEqual(connectionDiagnostics({phase:'conversation',status:404,model:'account-model'},'1.9.6'),{
    stage:'Submitting the request',httpStatus:404,automaticModel:'account-model',extensionVersion:'1.9.6'
  });
});
