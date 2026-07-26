globalThis.__timing__.logStart('Load chunks/build/index-oori5dI7');import { _ as __nuxt_component_0$1 } from './nuxt-link-Bg9bsIyC.mjs';
import { defineComponent, unref, mergeProps, withCtx, createVNode, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrRenderComponent, ssrRenderList, ssrInterpolate, ssrRenderClass } from 'vue/server-renderer';
import { _ as _export_sfc } from './server.mjs';
import '../_/nitro.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';
import '../routes/renderer.mjs';
import 'vue-bundle-renderer/runtime';
import 'unhead/server';
import 'devalue';
import 'unhead/utils';
import 'unhead/plugins';
import 'vue-router';

const _sfc_main$4 = {};
function _sfc_ssrRender$2(_ctx, _push, _parent, _attrs) {
  const _component_NuxtLink = __nuxt_component_0$1;
  _push(`<!--[--><div class="ticker" aria-label="\u793E\u56E2\u6807\u8BED"><span>MAKE / SHARE / BREAK / REBUILD /</span><span>MAKE / SHARE / BREAK / REBUILD /</span></div><header class="site-header">`);
  _push(ssrRenderComponent(_component_NuxtLink, {
    to: "/",
    class: "brand",
    "aria-label": "\u8FD4\u56DE\u9996\u9875"
  }, {
    default: withCtx((_, _push2, _parent2, _scopeId) => {
      if (_push2) {
        _push2(`<b${_scopeId}>IT</b><span${_scopeId}>Ex</span><i${_scopeId}>\xAE</i>`);
      } else {
        return [
          createVNode("b", null, "IT"),
          createVNode("span", null, "Ex"),
          createVNode("i", null, "\xAE")
        ];
      }
    }),
    _: 1
  }, _parent));
  _push(`<nav aria-label="\u4E3B\u5BFC\u822A"><a href="#about">\u6211\u4EEC\u662F\u8C01</a><a href="#work">\u6B63\u5728\u53D1\u751F</a><a href="#join">\u52A0\u5165\u6211\u4EEC</a></nav><a class="header-cta" href="#join">OPEN CALL \u2197</a></header><!--]-->`);
}
const _sfc_setup$4 = _sfc_main$4.setup;
_sfc_main$4.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/SiteHeader.vue");
  return _sfc_setup$4 ? _sfc_setup$4(props, ctx) : void 0;
};
const __nuxt_component_0 = /* @__PURE__ */ _export_sfc(_sfc_main$4, [["ssrRender", _sfc_ssrRender$2]]);
const _sfc_main$3 = {};
function _sfc_ssrRender$1(_ctx, _push, _parent, _attrs) {
  _push(`<section${ssrRenderAttrs(mergeProps({ class: "hero" }, _attrs))}><div class="hero-side"><span>ZH U ZH O U</span><span>2026 / ISSUE 01</span></div><div class="hero-copy"><p class="eyebrow">\u682A\u6D32\u5E02\u5357\u65B9\u4E2D\u5B66 \xB7 \u5B66\u751F\u81EA\u4E3B\u6280\u672F\u793E\u7FA4</p><h1>\u4FE1\u606F<br><em>\u62D3\u5C55</em>\u793E</h1><div class="hero-foot"><p>\u4E0D\u53EA\u4F7F\u7528\u6280\u672F\u3002<br>\u4E5F\u628A\u5B83\u62C6\u5F00\u3001\u91CD\u7EC4\u3001\u4EA4\u7ED9\u4E0B\u4E00\u4E2A\u4EBA\u3002</p><a class="round-link" href="#about">\u5411\u4E0B\u770B <span>\u2193</span></a></div></div><aside class="hero-poster" aria-label="\u793E\u56E2\u89C6\u89C9\u6807\u8BC6"><div class="poster-bars"><!--[-->`);
  ssrRenderList(5, (item) => {
    _push(`<i></i>`);
  });
  _push(`<!--]--></div><div class="poster-stamp">NANFANG<br>INFO<br>EXPANSION</div><div class="poster-orbit">ITEX \xB7 ITEX \xB7 ITEX \xB7 ITEX \xB7</div><div class="poster-mark">01</div></aside></section>`);
}
const _sfc_setup$3 = _sfc_main$3.setup;
_sfc_main$3.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/HeroPanel.vue");
  return _sfc_setup$3 ? _sfc_setup$3(props, ctx) : void 0;
};
const __nuxt_component_1 = /* @__PURE__ */ _export_sfc(_sfc_main$3, [["ssrRender", _sfc_ssrRender$1]]);
const _sfc_main$2 = /* @__PURE__ */ defineComponent({
  __name: "ProjectCard",
  __ssrInlineRender: true,
  props: {
    project: {}
  },
  setup(__props) {
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<article${ssrRenderAttrs(mergeProps({
        class: ["project", __props.project.tone]
      }, _attrs))}><span class="number">${ssrInterpolate(__props.project.number)}</span><span class="tag">${ssrInterpolate(__props.project.tag)}</span><h3>${ssrInterpolate(__props.project.title)}</h3><p>${ssrInterpolate(__props.project.description)}</p><a href="#join">\u67E5\u770B\u65B9\u5411 <b>\u2192</b></a><div class="${ssrRenderClass([`decoration-${__props.project.tone}`, "project-decoration"])}">${ssrInterpolate(__props.project.decoration)}</div></article>`);
    };
  }
});
const _sfc_setup$2 = _sfc_main$2.setup;
_sfc_main$2.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/ProjectCard.vue");
  return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};
const _sfc_main$1 = {};
function _sfc_ssrRender(_ctx, _push, _parent, _attrs) {
  _push(`<footer${ssrRenderAttrs(_attrs)}><span>ITEx / NANFANG INFO EXPANSION CLUB</span><span>\u5B66\u751F\u81EA\u53D1\u7EC4\u7EC7 \xB7 \u975E\u5B66\u6821\u5B98\u65B9\u7AD9\u70B9</span><span>\xA9 2026</span></footer>`);
}
const _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/SiteFooter.vue");
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
const __nuxt_component_3 = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["ssrRender", _sfc_ssrRender]]);
const projects = [
  { number: "01", tag: "FIELD SUPPORT", title: "\u73ED\u7EA7\u6570\u5B57\n\u6025\u6551\u7BB1", description: "\u628A\u65E5\u5E38\u7EF4\u62A4\u7ECF\u9A8C\u6574\u7406\u6210\u53EF\u590D\u7528\u7684\u6E05\u5355\u3001\u5DE5\u5177\u4E0E\u8BF4\u660E\uFF0C\u8BA9\u201C\u4E0D\u4F1A\u7528\u201D\u5C11\u4E00\u70B9\u3002", tone: "yellow", decoration: "\u271A" },
  { number: "02", tag: "BUILD LAB", title: "\u5C0F\u5DE5\u5177\n\u8BD5\u9A8C\u573A", description: "\u4ECE\u4E00\u4E2A\u4E0D\u987A\u624B\u7684\u77AC\u95F4\u5F00\u59CB\uFF0C\u7528\u4EE3\u7801\u3001\u81EA\u52A8\u5316\u548C\u7F51\u9875\u628A\u5B83\u53D8\u5F97\u66F4\u597D\u4E00\u70B9\u3002", tone: "blue", decoration: "</>\n0010\n1101" },
  { number: "03", tag: "OPEN ARCHIVE", title: "\u6821\u56ED\u521B\u4F5C\n\u516C\u5F00\u5B58\u6863", description: "\u628A\u4F5C\u54C1\u3001\u6559\u7A0B\u548C\u5931\u8D25\u7684\u8BB0\u5F55\u7559\u4E0B\u6765\u3002\u4E0B\u4E00\u4F4D\u597D\u5947\u7684\u4EBA\uFF0C\u4E0D\u5FC5\u4ECE\u96F6\u5F00\u59CB\u3002", tone: "red", decoration: "PUBLIC\nACCESS" }
];
const principles = [
  ["01", "\u5148\u52A8\u624B\uFF0C\u518D\u8BA8\u8BBA\u3002", "BUILD FIRST"],
  ["02", "\u5206\u4EAB\u6BD4\u72EC\u5360\u66F4\u9177\u3002", "SHARE WHAT WORKS"],
  ["03", "\u53EF\u4EE5\u63D0\u95EE\uFF0C\u4E5F\u53EF\u4EE5\u8BF4\u201C\u6211\u4E0D\u77E5\u9053\u201D\u3002", "STAY CURIOUS"],
  ["04", "\u5C0A\u91CD\u89C4\u5219\uFF0C\u4E5F\u4FDD\u7559\u521B\u9020\u529B\u3002", "THINK RESPONSIBLY"]
];
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "index",
  __ssrInlineRender: true,
  setup(__props) {
    return (_ctx, _push, _parent, _attrs) => {
      const _component_SiteHeader = __nuxt_component_0;
      const _component_HeroPanel = __nuxt_component_1;
      const _component_ProjectCard = _sfc_main$2;
      const _component_SiteFooter = __nuxt_component_3;
      _push(`<div${ssrRenderAttrs(_attrs)}><div class="noise" aria-hidden="true"></div>`);
      _push(ssrRenderComponent(_component_SiteHeader, null, null, _parent));
      _push(`<main id="top">`);
      _push(ssrRenderComponent(_component_HeroPanel, null, null, _parent));
      _push(`<section id="about" class="manifesto"><p class="section-index">01 / ABOUT</p><h2>\u8BA9\u597D\u5947\u5FC3<br>\u6709\u5730\u65B9<span>\u843D\u5730\u3002</span></h2><div class="manifesto-text"><p>\u6211\u4EEC\u662F\u4E00\u7FA4\u5728\u6821\u56ED\u91CC\u6298\u817E\u7535\u8111\u3001\u505A\u5C0F\u5DE5\u5177\u3001\u7814\u7A76\u7F51\u7EDC\u4E0E\u521B\u610F\u8868\u8FBE\u7684\u4EBA\u3002\u6709\u4EBA\u4F1A\u4FEE\u8BBE\u5907\uFF0C\u6709\u4EBA\u5199\u4EE3\u7801\uFF0C\u6709\u4EBA\u505A\u89C6\u89C9\uFF0C\u4E5F\u6709\u4EBA\u53EA\u662F\u60F3\u5F04\u61C2\u201C\u5B83\u4E3A\u4EC0\u4E48\u8FD9\u6837\u8FD0\u4F5C\u201D\u3002</p><p>\u4FE1\u606F\u62D3\u5C55\u793E\u4E0D\u662F\u57F9\u8BAD\u73ED\u3002\u8FD9\u91CC\u6CA1\u6709\u6807\u51C6\u7B54\u6848\uFF0C\u53EA\u6709\u4E00\u8D77\u628A\u95EE\u9898\u53D8\u6210\u4F5C\u54C1\u7684\u540C\u4F34\u3002</p></div><div class="statement">KEEP IT<br>CURIOUS.</div></section><section id="work" class="work"><div class="section-heading"><p class="section-index">02 / ON THE TABLE</p><h2>\u6B63\u5728\u53D1\u751F<br><span>\u7684\u4E8B\u60C5</span></h2><p class="mono-note">\u66F4\u65B0\u4E8E 2026.07<br>\u6BCF\u4E00\u6B21\u5C1D\u8BD5\u90FD\u503C\u5F97\u8BB0\u5F55</p></div><div class="project-grid"><!--[-->`);
      ssrRenderList(unref(projects), (project) => {
        _push(ssrRenderComponent(_component_ProjectCard, {
          key: project.number,
          project
        }, null, _parent));
      });
      _push(`<!--]--></div></section><section class="rules"><p class="section-index">03 / GROUND RULES</p><div class="rules-title"><h2>\u6211\u4EEC\u76F8\u4FE1<br><span>\u8FD9\u4E9B\u4E8B</span></h2><div>\u2731</div></div><ol><!--[-->`);
      ssrRenderList(unref(principles), (rule) => {
        _push(`<li><b>${ssrInterpolate(rule[0])}</b><span>${ssrInterpolate(rule[1])}</span><small>${ssrInterpolate(rule[2])}</small></li>`);
      });
      _push(`<!--]--></ol></section><section id="join" class="join"><div class="join-label">04 / OPEN INVITATION</div><div class="join-main"><h2>\u5E26\u7740\u4F60\u7684<br><em>\u95EE\u9898</em>\u6765\u3002</h2><p>\u4E0D\u9700\u8981\u5C65\u5386\uFF0C\u4E0D\u9650\u6280\u80FD\u6808\u3002<br>\u5982\u679C\u4F60\u5BF9\u201C\u600E\u4E48\u8BA9\u5B83\u66F4\u597D\u201D\u611F\u5230\u5174\u594B\uFF0C\u6211\u4EEC\u60F3\u8BA4\u8BC6\u4F60\u3002</p><a class="big-button" href="mailto:hello@nfix.club?subject=\u6211\u60F3\u52A0\u5165\u4FE1\u606F\u62D3\u5C55\u793E">\u53D1\u9001\u4E00\u5C01\u81EA\u6211\u4ECB\u7ECD <span>\u2197</span></a></div><div class="join-side"><span>\u5357\u65B9\u4E2D\u5B66</span><b>ITEx<br>CLUB</b><span>STUDENT RUN / NON-OFFICIAL</span></div></section></main>`);
      _push(ssrRenderComponent(_component_SiteFooter, null, null, _parent));
      _push(`</div>`);
    };
  }
});
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("pages/index.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};

export { _sfc_main as default };;globalThis.__timing__.logEnd('Load chunks/build/index-oori5dI7');
//# sourceMappingURL=index-oori5dI7.mjs.map
