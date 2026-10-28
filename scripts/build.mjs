import {build} from 'vite';
for(const mode of ['production','background','content'])await build({mode});
