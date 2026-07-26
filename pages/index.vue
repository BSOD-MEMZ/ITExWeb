<script setup lang="ts">
import { principles, projects } from '~/data/site'
</script>

<template>
  <div><div class="noise" aria-hidden="true" /><SiteHeader />
    <main id="top">
      <HeroPanel />
      <section id="about" class="manifesto"><p class="section-index">01 / ABOUT</p><h2>让好奇心<br>有地方<span>落地。</span></h2>
        <div class="manifesto-text"><p>我们是一群在校园里折腾电脑、做小工具、研究网络与创意表达的人。有人会修设备，有人写代码，有人做视觉，也有人只是想弄懂“它为什么这样运作”。</p><p>信息拓展社不是培训班。这里没有标准答案，只有一起把问题变成作品的同伴。</p></div><div class="statement">KEEP IT<br>CURIOUS.</div>
      </section>
      <section id="work" class="work"><div class="section-heading"><p class="section-index">02 / ON THE TABLE</p><h2>正在发生<br><span>的事情</span></h2><p class="mono-note">更新于 2026.07<br>每一次尝试都值得记录</p></div><div class="project-grid"><ProjectCard v-for="project in projects" :key="project.number" :project="project" /></div></section>
      <section class="rules"><p class="section-index">03 / GROUND RULES</p><div class="rules-title"><h2>我们相信<br><span>这些事</span></h2><div>✱</div></div><ol><li v-for="rule in principles" :key="rule[0]"><b>{{ rule[0] }}</b><span>{{ rule[1] }}</span><small>{{ rule[2] }}</small></li></ol></section>
      <section id="join" class="join"><div class="join-label">04 / OPEN INVITATION</div><div class="join-main"><h2>带着你的<br><em>问题</em>来。</h2><p>不需要履历，不限技能栈。<br>如果你对“怎么让它更好”感到兴奋，我们想认识你。</p><a class="big-button" href="mailto:hello@nfix.club?subject=我想加入信息拓展社">发送一封自我介绍 <span>↗</span></a></div><div class="join-side"><span>南方中学</span><b>ITEx<br>CLUB</b><span>STUDENT RUN / NON-OFFICIAL</span></div></section>
    </main><SiteFooter />
  </div>
</template>
