import {bindCloseSourceSetting} from "../shared/batch-preferences.js";
const status=document.getElementById("batch-settings-status");
bindCloseSourceSetting(document.getElementById("batch-close-source-tabs"),message=>{status.textContent=message;})
  .catch(error=>{status.textContent=error.message;});
