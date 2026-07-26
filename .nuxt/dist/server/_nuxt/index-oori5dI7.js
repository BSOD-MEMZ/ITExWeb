import { _ as __nuxt_component_0$1 } from "./nuxt-link-Bg9bsIyC.js";
import { withCtx, createVNode, useSSRContext, mergeProps, defineComponent, unref } from "vue";
import { ssrRenderComponent, ssrRenderAttrs, ssrRenderList, ssrInterpolate, ssrRenderClass } from "vue/server-renderer";
import { _ as _export_sfc } from "../server.mjs";
import "D:/Dev/ITEx/node_modules/ufo/dist/index.mjs";
import "D:/Dev/ITEx/node_modules/defu/dist/defu.mjs";
import "D:/Dev/ITEx/node_modules/ofetch/dist/node.mjs";
import "#internal/nuxt/paths";
import "D:/Dev/ITEx/node_modules/hookable/dist/index.mjs";
import "D:/Dev/ITEx/node_modules/unctx/dist/index.mjs";
import "D:/Dev/ITEx/node_modules/h3/dist/index.mjs";
import "vue-router";
const _sfc_main$4 = {};
function _sfc_ssrRender$2(_ctx, _push, _parent, _attrs) {
  const _component_NuxtLink = __nuxt_component_0$1;
  _push(`<!--[--><div class="ticker" aria-label="社团标语"><span>MAKE / SHARE / BREAK / REBUILD /</span><span>MAKE / SHARE / BREAK / REBUILD /</span></div><header class="site-header">`);
  _push(ssrRenderComponent(_component_NuxtLink, {
    to: "/",
    class: "brand",
    "aria-label": "返回首页"
  }, {
    default: withCtx((_, _push2, _parent2, _scopeId) => {
      if (_push2) {
        _push2(`<b${_scopeId}>IT</b><span${_scopeId}>Ex</span><i${_scopeId}>®</i>`);
      } else {
        return [
          createVNode("b", null, "IT"),
          createVNode("span", null, "Ex"),
          createVNode("i", null, "®")
        ];
      }
    }),
    _: 1
  }, _parent));
  _push(`<nav aria-label="主导航"><a href="#about">我们是谁</a><a href="#work">正在发生</a><a href="#join">加入我们</a></nav><a class="header-cta" href="#join">OPEN CALL ↗</a></header><!--]-->`);
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
  _push(`<section${ssrRenderAttrs(mergeProps({ class: "hero" }, _attrs))}><div class="hero-side"><span>ZH U ZH O U</span><span>2026 / ISSUE 01</span></div><div class="hero-copy"><p class="eyebrow">株洲市南方中学 · 学生自主技术社群</p><h1>信息<br><em>拓展</em>社</h1><div class="hero-foot"><p>不只使用技术。<br>也把它拆开、重组、交给下一个人。</p><a class="round-link" href="#about">向下看 <span>↓</span></a></div></div><aside class="hero-poster" aria-label="社团视觉标识"><div class="poster-bars"><!--[-->`);
  ssrRenderList(5, (item) => {
    _push(`<i></i>`);
  });
  _push(`<!--]--></div><div class="poster-stamp">NANFANG<br>INFO<br>EXPANSION</div><div class="poster-orbit">ITEX · ITEX · ITEX · ITEX ·</div><div class="poster-mark">01</div></aside></section>`);
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
      }, _attrs))}><span class="number">${ssrInterpolate(__props.project.number)}</span><span class="tag">${ssrInterpolate(__props.project.tag)}</span><h3>${ssrInterpolate(__props.project.title)}</h3><p>${ssrInterpolate(__props.project.description)}</p><a href="#join">查看方向 <b>→</b></a><div class="${ssrRenderClass([`decoration-${__props.project.tone}`, "project-decoration"])}">${ssrInterpolate(__props.project.decoration)}</div></article>`);
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
  _push(`<footer${ssrRenderAttrs(_attrs)}><span>ITEx / NANFANG INFO EXPANSION CLUB</span><span>学生自发组织 · 非学校官方站点</span><span>© 2026</span></footer>`);
}
const _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/SiteFooter.vue");
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
const __nuxt_component_3 = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["ssrRender", _sfc_ssrRender]]);
const projects = [
  { number: "01", tag: "FIELD SUPPORT", title: "班级数字\n急救箱", description: "把日常维护经验整理成可复用的清单、工具与说明，让“不会用”少一点。", tone: "yellow", decoration: "✚" },
  { number: "02", tag: "BUILD LAB", title: "小工具\n试验场", description: "从一个不顺手的瞬间开始，用代码、自动化和网页把它变得更好一点。", tone: "blue", decoration: "</>\n0010\n1101" },
  { number: "03", tag: "OPEN ARCHIVE", title: "校园创作\n公开存档", description: "把作品、教程和失败的记录留下来。下一位好奇的人，不必从零开始。", tone: "red", decoration: "PUBLIC\nACCESS" }
];
const principles = [
  ["01", "先动手，再讨论。", "BUILD FIRST"],
  ["02", "分享比独占更酷。", "SHARE WHAT WORKS"],
  ["03", "可以提问，也可以说“我不知道”。", "STAY CURIOUS"],
  ["04", "尊重规则，也保留创造力。", "THINK RESPONSIBLY"]
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
      _push(`<section id="about" class="manifesto"><p class="section-index">01 / ABOUT</p><h2>让好奇心<br>有地方<span>落地。</span></h2><div class="manifesto-text"><p>我们是一群在校园里折腾电脑、做小工具、研究网络与创意表达的人。有人会修设备，有人写代码，有人做视觉，也有人只是想弄懂“它为什么这样运作”。</p><p>信息拓展社不是培训班。这里没有标准答案，只有一起把问题变成作品的同伴。</p></div><div class="statement">KEEP IT<br>CURIOUS.</div></section><section id="work" class="work"><div class="section-heading"><p class="section-index">02 / ON THE TABLE</p><h2>正在发生<br><span>的事情</span></h2><p class="mono-note">更新于 2026.07<br>每一次尝试都值得记录</p></div><div class="project-grid"><!--[-->`);
      ssrRenderList(unref(projects), (project) => {
        _push(ssrRenderComponent(_component_ProjectCard, {
          key: project.number,
          project
        }, null, _parent));
      });
      _push(`<!--]--></div></section><section class="rules"><p class="section-index">03 / GROUND RULES</p><div class="rules-title"><h2>我们相信<br><span>这些事</span></h2><div>✱</div></div><ol><!--[-->`);
      ssrRenderList(unref(principles), (rule) => {
        _push(`<li><b>${ssrInterpolate(rule[0])}</b><span>${ssrInterpolate(rule[1])}</span><small>${ssrInterpolate(rule[2])}</small></li>`);
      });
      _push(`<!--]--></ol></section><section id="join" class="join"><div class="join-label">04 / OPEN INVITATION</div><div class="join-main"><h2>带着你的<br><em>问题</em>来。</h2><p>不需要履历，不限技能栈。<br>如果你对“怎么让它更好”感到兴奋，我们想认识你。</p><a class="big-button" href="mailto:hello@nfix.club?subject=我想加入信息拓展社">发送一封自我介绍 <span>↗</span></a></div><div class="join-side"><span>南方中学</span><b>ITEx<br>CLUB</b><span>STUDENT RUN / NON-OFFICIAL</span></div></section></main>`);
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
export {
  _sfc_main as default
};
//# sourceMappingURL=index-oori5dI7.js.map
